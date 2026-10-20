"""
Playwright automation for fetching attendance reports from the SVKM/NMIMS SAP Portal.

PROVEN WORKING ARCHITECTURE:
- Login: Authenticate via mobile portal (Pixel 7 emulation bypasses desktop CAPTCHA requirements)
- Navigation: Click 'Attendance Display for Students' to load the WebDynpro application
- Frame Isolation: Target the 'isolatedWorkArea' iframe (ZSVKM_STUDENT_ATTENDANCE2)
- Form Interaction:
    * Academic Year: #WD2B-btn -> select latest year option (#WD2E)
    * Semester: #WD33-btn -> select semester (#WD57)
    * Report Type: #WD39-btn -> select 'Detail Report' (#WD3C)
    * Date Range: #WD46 (start) & #WD4B (end) populated via UCF_EventProcessor + keyboard typing
    * Submit: #WD51 button triggers SAP WebDynpro PDF generator
- PDF Extraction:
    * SAP WebDynpro dynamically renders an embedded PDF <object> with class 'lsPdfObject'
    * The direct URL is extracted and fetched via the authenticated browser context (ctx.request.get)
    * Fallback to direct browser download event if triggered
- Returns high-fidelity raw PDF bytes ready for parsing.
"""

import sys
import re
import asyncio
import logging
import concurrent.futures
from datetime import datetime
from urllib.parse import urljoin
from playwright.async_api import async_playwright, Page, Frame

logger = logging.getLogger(__name__)




async def _get_work_frame(page: Page, timeout_ms: int = 15000) -> Frame:
    """Wait for and return the isolatedWorkArea iframe."""
    deadline = asyncio.get_event_loop().time() + timeout_ms / 1000
    while asyncio.get_event_loop().time() < deadline:
        for f in page.frames:
            if f.name == "isolatedWorkArea" or "ZSVKM_STUDENT_ATTENDANCE2" in f.url:
                return f
        await asyncio.sleep(0.5)
    raise ValueError(
        "Could not find the Attendance application frame (isolatedWorkArea). "
        "Please ensure you are logged in and clicked 'Attendance Display for Students'."
    )


def _parse_academic_year(text: str) -> int:
    """Extract the highest 4-digit year from string, e.g. 'Acad .Year 2026-2027' -> 2027."""
    years = [int(y) for y in re.findall(r'\b(20\d\d)\b', text)]
    return max(years) if years else -1


def _parse_semester_score(text: str) -> int:
    """Extract semester number from 'Semester III', 'Sem 4', 'Trimester 2', etc."""
    roman_map = {
        'VIII': 8, 'VII': 7, 'VI': 6, 'V': 5, 'IV': 4,
        'III': 3, 'II': 2, 'I': 1, 'IX': 9, 'X': 10
    }
    for r, val in sorted(roman_map.items(), key=lambda x: -len(x[0])):
        if re.search(r'\b' + r + r'\b', text, re.IGNORECASE):
            return val
    digits = re.findall(r'\b(\d+)\b', text)
    if digits:
        return int(digits[0])
    return 0


async def _select_dropdown_option(wf: Frame, page: Page, input_id: str, criteria_fn, name: str):
    """
    Dynamically opens a WebDynpro ComboBox dropdown by input_id (e.g. WD2B, WD33, WD39),
    finds its associated listbox popup, inspects all options, uses criteria_fn to pick
    the best option, clicks it, and waits for WebDynpro to process the change.

    Uses event-driven waits instead of fixed delays:
    - Popup open: waits for the listbox to become visible in the DOM.
    - AJAX settle: inspects the actual #ur-loading state and only blocks if SAP
      is still processing; proceeds immediately if the response was already fast.
    """
    btn_sel = f"#{input_id}-btn, #{input_id}"
    btn = await wf.wait_for_selector(btn_sel, timeout=10000, state="visible")
    await btn.click()

    # Event-driven popup open wait: proceed as soon as the listbox is visible
    try:
        await wf.wait_for_selector(
            ".lsListbox--popup:not([style*='display: none']), "
            ".lsListbox--popup[ls-layeredcontrol='X']",
            timeout=3000, state="visible"
        )
    except Exception:
        # Fallback: listbox selector may not match – give it a short flat pause
        await page.wait_for_timeout(100)

    options_info = await wf.evaluate("""(id) => {
        const input = document.getElementById(id);
        if (!input) return { error: 'input not found' };
        
        let listboxId = null;
        try {
            const lsdata = JSON.parse(input.getAttribute('lsdata') || '{}');
            listboxId = lsdata['3'] || null;
        } catch(e) {}

        let listbox = listboxId ? document.getElementById(listboxId) : null;
        if (!listbox) {
            const owns = input.getAttribute('aria-owns') || (input.parentElement ? input.parentElement.getAttribute('aria-owns') : null);
            if (owns) listbox = document.getElementById(owns.trim().split(' ')[0]);
        }
        if (!listbox) {
            listbox = document.querySelector('.lsListbox--popup[ls-layeredcontrol="X"]') ||
                      document.querySelector('.lsListbox--popup:not([style*="display: none"])');
        }

        if (!listbox) return { error: 'listbox popup not found' };

        const items = Array.from(listbox.querySelectorAll('.lsListbox__value, [role="option"]'));
        return {
            listboxId: listbox.id,
            options: items.map((opt, idx) => ({
                id: opt.id,
                text: (opt.innerText || opt.getAttribute('data-itemvalue1') || '').trim(),
                itemKey: opt.getAttribute('data-itemkey') || '',
                index: idx
            }))
        };
    }""", input_id)

    if 'error' in options_info or not options_info.get('options'):
        raise ValueError(f"Could not open dropdown options for {name} (#{input_id})")

    opts = options_info['options']
    logger.info(f"[scraper] Dropdown #{input_id} ({name}) options: {opts}")
    best_opt = criteria_fn(opts)
    if not best_opt:
        best_opt = opts[-1]

    logger.info(f"[scraper] Selected #{best_opt['id']} ('{best_opt['text']}') for {name}")
    opt_el = await wf.wait_for_selector(f"#{best_opt['id']}", timeout=5000)
    await opt_el.click()

    # Smart AJAX wait: give SAP a tiny moment to kick off the request, then
    # inspect the actual loading indicator state rather than sleeping a fixed amount.
    await page.wait_for_timeout(50)
    try:
        is_loading = await wf.evaluate("""() => {
            const el = document.getElementById('ur-loading');
            if (!el) return false;
            const style = el.getAttribute('style') || '';
            const busy = el.getAttribute('aria-busy');
            // Active if NOT hidden and NOT explicitly set to non-busy
            return !style.includes('display: none') && busy !== 'false';
        }""")
        if is_loading:
            # SAP is processing — wait for the indicator to clear
            await wf.wait_for_selector(
                "#ur-loading[style*='display: none'], #ur-loading:not([aria-busy='true'])",
                timeout=8000
            )
        # else: already done — proceed immediately
    except Exception:
        # Evaluation failed or element absent — small safety pause
        await page.wait_for_timeout(100)


async def fetch_attendance_report(username: str, password: str, headless: bool = False) -> bytes:

    """
    Automates logging into the SVKM SAP portal and fetching the attendance
    report as authentic PDF bytes using Playwright.

    If headless is False, launches a visible browser window on the desktop
    sized to Pixel 7 dimensions with slow-mo, popped to the top of the desktop.
    """
    logger.warning(f"[scraper] fetch_attendance_report called with headless={headless}")

    async with async_playwright() as p:
        pixel = p.devices["Pixel 7"]
        # Pixel 7 emulation: required for SAP portal mobile stability.
        # Phone dimensions: 412x839 viewport -> 430x920 outer window size.
        launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]
        if not headless:
            launch_args.extend([
                "--window-size=430,920",
                "--window-position=60,40",
            ])

        browser = await p.chromium.launch(
            headless=headless,
            args=launch_args,
            slow_mo=0,
        )
        context = await browser.new_context(**pixel, accept_downloads=True)
        page = await context.new_page()
        page.on("dialog", lambda dialog: asyncio.create_task(dialog.accept()))

        try:
            # -------------------------------------------------------
            # STEP 1: Navigate to portal
            # -------------------------------------------------------
            portal_url = "https://sdc-sppap1.svkm.ac.in:50001/irj/portal"
            try:
                await page.goto(portal_url, timeout=35000, wait_until="domcontentloaded")
            except Exception as e:
                raise ValueError(
                    f"Unable to connect to SAP Portal at {portal_url}. "
                    "Please ensure you are connected to the internet/university network."
                ) from e

            # -------------------------------------------------------
            # STEP 2: Fill credentials
            # -------------------------------------------------------
            user_input = await page.wait_for_selector(
                "input#logonuidfield, input[name='j_username'], input[name='j_user']",
                timeout=15000, state="visible"
            )
            if not user_input:
                raise ValueError("Username field not found on portal login page.")
            await user_input.fill(username)

            pass_input = await page.wait_for_selector(
                "input#logonpassfield, input[name='j_password']",
                timeout=10000, state="visible"
            )
            if not pass_input:
                raise ValueError("Password field not found on portal login page.")
            await pass_input.fill(password)

            # Handle captcha if present (Pixel 7 bypasses it, but handle as fallback)
            captcha_input = await page.query_selector("input#txtInput, input[name='txtInput']")
            if captcha_input and await captcha_input.is_visible():
                captcha_code = await page.evaluate("""() => {
                    if (typeof code === 'undefined' || !code) {
                        if (typeof Captcha === 'function') Captcha();
                    }
                    return typeof code !== 'undefined' ? code : null;
                }""")
                if captcha_code:
                    await captcha_input.fill(str(captcha_code))
                else:
                    raise ValueError(
                        "A CAPTCHA is required on the login page. "
                        "Please try again or use a different network."
                    )

            # -------------------------------------------------------
            # STEP 3: Click Login button
            # -------------------------------------------------------
            login_btn = await page.wait_for_selector(
                "input[name='uidPasswordLogon'], input.mobileButton, input#Button1, "
                "input[value='Log On'], button[id='logon_button'], input[type='submit']",
                timeout=15000, state="visible"
            )
            if login_btn:
                await login_btn.click()
            else:
                await page.evaluate("() => { if (document.forms[0]) document.forms[0].submit(); }")

            await page.wait_for_timeout(300)

            # Check for any modal or re-confirmation popup close button
            try:
                close_btn = await page.query_selector(
                    "[title='Close'], [aria-label='Close'], .urPWClose, svg, span:has-text('✕'), span:has-text('×')"
                )
                if close_btn and await close_btn.is_visible():
                    await close_btn.click()
                    await page.wait_for_timeout(0)
            except Exception:
                pass

            # Check for auth error
            auth_error = await page.query_selector(
                ".mobileErrorMessageText, .mobile_urMsgBarErr, .urMsgBarErr, .urTxtError"
            )
            if auth_error and await auth_error.is_visible():
                error_msg = (await auth_error.inner_text()).strip()
                if error_msg and any(w in error_msg.lower() for w in
                                     ["failed", "invalid", "denied", "incorrect", "locked", "error"]):
                    raise ValueError(
                        f"Authentication failed: {error_msg}. "
                        "Please check your Student ID and password."
                    )

            # -------------------------------------------------------
            # STEP 4: Click 'Attendance Display for Students'
            # -------------------------------------------------------
            att_link = None
            for _ in range(20):
                for ctx_obj in [page] + list(page.frames):
                    for sel in [
                        "text='Attendance Display for Students'",
                        "text=Attendance Display for Students",
                        "a:has-text('Attendance Display')",
                        "span:has-text('Attendance Display')",
                    ]:
                        try:
                            el = await ctx_obj.query_selector(sel)
                            if el and await el.is_visible():
                                att_link = el
                                break
                        except Exception:
                            pass
                    if att_link:
                        break
                if att_link:
                    break
                await asyncio.sleep(0.5)

            if not att_link:
                # JS fallback
                found = await page.evaluate("""() => {
                    const all = Array.from(document.querySelectorAll('a, span, td, div'));
                    const match = all.find(el =>
                        el.textContent && el.textContent.trim() === 'Attendance Display for Students'
                    );
                    if (match) { match.click(); return true; }
                    return false;
                }""")
                if not found:
                    raise ValueError(
                        "Logged in successfully but could not find the 'Attendance Display for Students' module link."
                    )
            else:
                await att_link.click()

            await page.wait_for_timeout(300)

            # -------------------------------------------------------
            # STEP 5: Get the isolatedWorkArea frame
            # -------------------------------------------------------
            wf = await _get_work_frame(page, timeout_ms=15000)

            # -------------------------------------------------------
            # STEP 6: Academic Year (WD2B) - select latest available year dynamically
            # -------------------------------------------------------
            def pick_latest_academic_year(opts):
                scored = []
                for o in opts:
                    score = max(_parse_academic_year(o['text']), _parse_academic_year(o['itemKey']))
                    scored.append((score, o['index'], o))
                scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
                return scored[0][2]

            await _select_dropdown_option(
                wf, page, "WD2B", pick_latest_academic_year, "Academic Year"
            )

            # -------------------------------------------------------
            # STEP 7: Semester (WD33) - select latest available semester dynamically
            # -------------------------------------------------------
            def pick_latest_semester(opts):
                scored = []
                for o in opts:
                    score = _parse_semester_score(o['text'])
                    scored.append((score, o['index'], o))
                scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
                return scored[0][2]

            await _select_dropdown_option(
                wf, page, "WD33", pick_latest_semester, "Semester"
            )

            # -------------------------------------------------------
            # STEP 8: Report Type (WD39) -> Detail Report
            # -------------------------------------------------------
            def pick_detail_report(opts):
                for o in opts:
                    if "detail" in o['text'].lower():
                        return o
                return opts[-1]

            await _select_dropdown_option(
                wf, page, "WD39", pick_detail_report, "Report Type (Detail Report)"
            )

            # -------------------------------------------------------
            # STEP 9: Fill dates using JS eval + keyboard typing
            # Start: 01.07.{academic year start}
            # End: today
            # -------------------------------------------------------
            try:
                selected_year_str = await wf.evaluate(
                    "(id) => { const el = document.getElementById(id); return el ? el.value : ''; }",
                    "WD2B"
                )
                years = [int(y) for y in re.findall(r'\b(20\d\d)\b', selected_year_str)]
                if years:
                    start_year = min(years)
                    start_date = f"01.07.{start_year}"
                else:
                    today = datetime.now()
                    start_date = f"01.07.{today.year if today.month >= 7 else today.year - 1}"
            except Exception:
                today = datetime.now()
                start_date = f"01.07.{today.year if today.month >= 7 else today.year - 1}"
            end_date = datetime.now().strftime("%d.%m.%Y")

            # Directly set values and fire SAP Lightspeed change events
            try:
                await wf.evaluate("""([sd, ed]) => {
                    function setVal(id, val) {
                        const el = document.getElementById(id);
                        if (!el) return;
                        el.value = val;
                        if (typeof UCF_EventProcessor !== 'undefined') {
                            UCF_EventProcessor.processClientEvent(el, 'Change', {});
                        }
                        el.dispatchEvent(new Event('change', {bubbles: true}));
                        el.dispatchEvent(new Event('blur', {bubbles: true}));
                    }
                    setVal('WD46', sd);
                    setVal('WD4B', ed);
                }""", [start_date, end_date])
            except Exception:
                pass

            await page.wait_for_timeout(0)

            # Robust date input finding (specific IDs or generic date inputs)
            start_el = None
            for sel in [
                "#WD46", "input[name='WD46']", "input.lsField__input[id*='46']",
                "input[title*='start' i]", "input[title*='from' i]"
            ]:
                try:
                    start_el = await wf.wait_for_selector(sel, timeout=3000, state="visible")
                    if start_el:
                        break
                except Exception:
                    pass

            end_el = None
            for sel in [
                "#WD4B", "input[name='WD4B']", "input.lsField__input[id*='4B']",
                "input[title*='end' i]", "input[title*='to' i]"
            ]:
                try:
                    end_el = await wf.wait_for_selector(sel, timeout=3000, state="visible")
                    if end_el:
                        break
                except Exception:
                    pass

            if not start_el or not end_el:
                # Fallback to positional text inputs in form
                all_inputs = await wf.query_selector_all("input.lsField__input, input[type='text']")
                vis = []
                for inp in all_inputs:
                    if await inp.is_visible():
                        vis.append(inp)
                if len(vis) >= 2:
                    if not start_el:
                        start_el = vis[-2]
                    if not end_el:
                        end_el = vis[-1]

            if start_el:
                try:
                    await start_el.fill(start_date)
                    await start_el.evaluate("""(el) => {
                        if (typeof UCF_EventProcessor !== 'undefined') {
                            UCF_EventProcessor.processClientEvent(el, 'Change', {});
                        }
                        el.dispatchEvent(new Event('input', {bubbles: true}));
                        el.dispatchEvent(new Event('change', {bubbles: true}));
                        el.dispatchEvent(new Event('blur', {bubbles: true}));
                    }""")
                except Exception:
                    pass

            if end_el:
                try:
                    await end_el.fill(end_date)
                    await end_el.evaluate("""(el) => {
                        if (typeof UCF_EventProcessor !== 'undefined') {
                            UCF_EventProcessor.processClientEvent(el, 'Change', {});
                        }
                        el.dispatchEvent(new Event('input', {bubbles: true}));
                        el.dispatchEvent(new Event('change', {bubbles: true}));
                        el.dispatchEvent(new Event('blur', {bubbles: true}));
                    }""")
                except Exception:
                    pass

            # -------------------------------------------------------
            # STEP 10: Setup download listener and click SUBMIT (#WD51)
            # -------------------------------------------------------
            submit_btn = await wf.wait_for_selector(
                "#WD51, div[role='button']:has-text('SUBMIT'), input[value='SUBMIT']",
                timeout=8000,
                state="visible"
            )
            if not submit_btn:
                raise ValueError("Could not find the SUBMIT button in the attendance form.")

            download_holder = []
            page.on("download", lambda dl: download_holder.append(dl))

            await submit_btn.click()

            # -------------------------------------------------------
            # STEP 11: Wait for PDF generation and extract bytes
            # -------------------------------------------------------
            pdf_bytes = None
            max_wait_seconds = 30
            poll_interval = 1.0

            for _ in range(int(max_wait_seconds / poll_interval)):
                await asyncio.sleep(poll_interval)

                # 1. Check if a browser download event fired
                if download_holder:
                    dl = download_holder[0]
                    dl_path = await dl.path()
                    if not dl_path:
                        import tempfile
                        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
                        tmp.close()
                        await dl.save_as(tmp.name)
                        dl_path = tmp.name
                    with open(dl_path, "rb") as fh:
                        pdf_bytes = fh.read()
                    if pdf_bytes and len(pdf_bytes) >= 1000:
                        return pdf_bytes

                # 2. Re-find the active work frame
                wf2 = page.frame(name="isolatedWorkArea")
                if not wf2:
                    for f in page.frames:
                        if "ZSVKM_STUDENT_ATTENDANCE2" in f.url:
                            wf2 = f
                            break

                if not wf2:
                    continue

                # 3. Check for portal error messages
                try:
                    content = await wf2.content()
                    if "Please select Period start date" in content or "Please select Period end date" in content:
                        raise ValueError(
                            "The portal rejected the date range. "
                            "Please ensure the selected academic year and dates are valid."
                        )
                except ValueError:
                    raise
                except Exception:
                    pass

                # 4. Look for PDF object/embed/lsdata in the work frame
                try:
                    pdf_data = await wf2.evaluate("""() => {
                        const obj = document.querySelector('object[type*="pdf"], object.lsPdfObject, embed[type*="pdf"]');
                        if (obj) {
                            return obj.getAttribute('data') || obj.getAttribute('src') || '';
                        }
                        const allEls = document.querySelectorAll('[lsdata*=".pdf"]');
                        for (const el of allEls) {
                            const lsdata = el.getAttribute('lsdata');
                            if (lsdata) {
                                const m = lsdata.match(/["']0["']\\s*:\\s*["']([^"']+\\.pdf[^"']*)["']/);
                                if (m) return m[1];
                            }
                        }
                        return null;
                    }""")
                    if pdf_data:
                        pdf_url = urljoin(wf2.url, pdf_data)
                        resp = await context.request.get(pdf_url)
                        if resp.status == 200:
                            body = await resp.body()
                            if body and len(body) >= 1000 and body.startswith(b"%PDF"):
                                return body
                except ValueError:
                    raise
                except Exception:
                    pass

            # Polling timed out
            raise ValueError(
                "Timed out waiting for the attendance report to be generated by the SAP portal. "
                "The university server may be slow or temporarily under maintenance."
            )

        except ValueError:
            if not headless:
                # Keep window visible briefly so user can see error state
                try:
                    await asyncio.sleep(3)
                except Exception:
                    pass
            raise
        except Exception as e:
            if not headless:
                try:
                    await asyncio.sleep(3)
                except Exception:
                    pass
            raise ValueError(f"Portal scraping failed: {e}") from e
        finally:
            try:
                await browser.close()
            except Exception:
                pass


def run_scraper_in_proactor_loop(username: str, password: str, headless: bool = True) -> bytes:
    """
    Executes fetch_attendance_report in a dedicated thread with a ProactorEventLoop.
    On Windows, this provides full desktop GUI access so the headed Chromium window
    is physically displayed on the user's screen in Pixel 7 dimensions, while isolating
    Playwright's event loop from Uvicorn's main loop.
    """
    logger.warning(f"[scraper] run_scraper_in_proactor_loop called with headless={headless}")

    def worker():
        if sys.platform == 'win32':
            policy = asyncio.WindowsProactorEventLoopPolicy()
            loop = policy.new_event_loop()
        else:
            loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(
                fetch_attendance_report(username, password, headless=headless)
            )
        finally:
            try:
                loop.close()
            except Exception:
                pass

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(worker).result()
