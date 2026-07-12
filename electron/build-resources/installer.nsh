; Custom NSIS finish page — auto-included by electron-builder because it is named
; `installer.nsh` and lives in the configured buildResources dir (electron/build-resources).
;
; Defining `customFinishPage` REPLACES electron-builder's default finish page, so we
; reproduce its "run the app after install" checkbox (un-elevated, via StdUtils) AND add an
; opt-in "Add to Steam library" checkbox. Checking it launches
;   "<App>.exe" --add-to-steam
; a HEADLESS one-shot (electron/steamShortcut.ts) that registers a Non-Steam Game shortcut +
; artwork in Steam's shortcuts.vdf and exits. The app IS the gate: it does nothing when Steam
; isn't installed (so an unchecked box, or no Steam, changes nothing).
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

  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "TMRunAfterFinish"
  !endif

  ; Repurpose the "show readme" checkbox as our opt-in Steam checkbox. Default UNCHECKED.
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Add to Steam library (with artwork)"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "TMAddToSteam"

  !insertmacro MUI_PAGE_FINISH
!macroend
