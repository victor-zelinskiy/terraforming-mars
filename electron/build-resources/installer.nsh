; Custom NSIS finish page — auto-included by electron-builder because it is named
; `installer.nsh` and lives in the configured buildResources dir (electron/build-resources).
;
; Defining `customFinishPage` REPLACES electron-builder's default finish page, so we
; reproduce its "run the app after install" checkbox (un-elevated, via StdUtils) AND add an
; "Add to Steam library" checkbox. Checking it launches
;   "<App>.exe" --add-to-steam
; a HEADLESS one-shot (electron/steamShortcut.ts) that registers a Non-Steam Game shortcut +
; artwork in Steam's shortcuts.vdf and exits.
;
; The checkbox is DEFAULT-CHECKED when Steam is detected (registry) and HIDDEN when it is not
; — so it's a one-glance opt-in for Steam users and invisible noise for everyone else. The app
; is still the final gate: `--add-to-steam` does nothing if Steam turns out not to be present.
;
; IMPORTANT: the two helper Functions live INSIDE the customFinishPage macro on purpose. The
; macro body is expanded at `!insertmacro customFinishPage` (deep in the installer template,
; AFTER common.nsh), where ${APP_EXECUTABLE_FILENAME}, $launchLink, ${isUpdated} and the
; StdUtils macros are all defined — a top-level Function in this file would instead land in
; electron-builder's shared HEADER, before those symbols exist, and fail to compile. The macro
; is inserted exactly once (installer only, not the uninstaller), so defining the functions
; there is safe.
;
; ExecShellAsUser launches un-elevated from the (per-user, non-elevated) installer — the
; shortcut must be written into the CURRENT user's Steam userdata, never SYSTEM's.

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "TMRunAfterFinish"
  !endif

  ; Repurpose the "show readme" checkbox as our opt-in Steam checkbox. Created UNCHECKED;
  ; TMFinishShow ticks it on (or hides it) at runtime based on Steam detection.
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Add to Steam library (with artwork)"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "TMAddToSteam"

  ; Runtime checkbox default (Steam detection), run just before the page is shown.
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW "TMFinishShow"

  !insertmacro MUI_PAGE_FINISH

  ; The helper functions are defined AFTER the page on purpose: MUI declares
  ; $mui.FinishPage.ShowReadme inside MUI_PAGE_FINISH, so referencing it earlier would be an
  ; "unknown variable" (which electron-builder compiles as a fatal error). Placing them here —
  ; after the Var exists — is fine: MUI wires each one as a Call-by-name, which NSIS resolves
  ; in its second pass regardless of definition order.

  ; Launch after install — mirrors electron-builder's default StartApp, but with a unique
  ; name (avoids any clash) and a scratch register instead of a Var declaration.
  Function TMRunAfterFinish
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  ; Opt-in Steam integration — runs only when the checkbox is ticked at Finish.
  Function TMAddToSteam
    ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" "--add-to-steam"
  FunctionEnd

  ; Runs after the finish-page controls are built ($mui.FinishPage.ShowReadme is set) and
  ; BEFORE nsDialogs::Show — the one place to set the checkbox state at runtime. The box is
  ; created UNCHECKED (SHOWREADME_NOTCHECKED); here we tick it ON when Steam is detected, and
  ; HIDE it (staying unchecked, so TMAddToSteam never runs) when Steam isn't installed.
  Function TMFinishShow
    Push $0
    ; HKCU SteamPath is written for a per-user Steam; fall back to the machine InstallPath
    ; (the 32-bit installer's HKLM view auto-redirects to WOW6432Node).
    ReadRegStr $0 HKCU "Software\Valve\Steam" "SteamPath"
    StrCmp $0 "" 0 tm_steam_found
      ReadRegStr $0 HKLM "SOFTWARE\Valve\Steam" "InstallPath"
      StrCmp $0 "" tm_steam_missing tm_steam_found
    tm_steam_found:
      ${NSD_Check} $mui.FinishPage.ShowReadme
      Goto tm_steam_done
    tm_steam_missing:
      ShowWindow $mui.FinishPage.ShowReadme 0   ; SW_HIDE
    tm_steam_done:
    Pop $0
  FunctionEnd
!macroend
