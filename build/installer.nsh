; Registers Dock Web as a web browser so Windows lists it under Settings > Apps > Default apps
; (http/https links, .htm/.html/.pdf files). Windows never makes it the default by itself: the user picks it there.
; Opened links/files arrive as the first argument (see openArgs in src/main/index.ts).
; ASCII only: NSIS may read this file in the ANSI codepage
!macro customInstall
  WriteRegStr SHCTX "Software\Classes\DockWebURL" "" "Dock Web URL"
  WriteRegStr SHCTX "Software\Classes\DockWebURL" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\DockWebURL\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "Software\Classes\DockWebURL\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  WriteRegStr SHCTX "Software\Classes\DockWebHTML" "" "Dock Web Document"
  WriteRegStr SHCTX "Software\Classes\DockWebHTML\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "Software\Classes\DockWebHTML\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  StrCpy $0 "Software\Clients\StartMenuInternet\Dock Web"
  WriteRegStr SHCTX "$0" "" "Dock Web"
  WriteRegStr SHCTX "$0\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "$0\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  WriteRegStr SHCTX "$0\Capabilities" "ApplicationName" "Dock Web"
  WriteRegStr SHCTX "$0\Capabilities" "ApplicationDescription" "Small always-on-top web window"
  WriteRegStr SHCTX "$0\Capabilities" "ApplicationIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr SHCTX "$0\Capabilities\URLAssociations" "http" "DockWebURL"
  WriteRegStr SHCTX "$0\Capabilities\URLAssociations" "https" "DockWebURL"
  WriteRegStr SHCTX "$0\Capabilities\FileAssociations" ".htm" "DockWebHTML"
  WriteRegStr SHCTX "$0\Capabilities\FileAssociations" ".html" "DockWebHTML"
  WriteRegStr SHCTX "$0\Capabilities\FileAssociations" ".pdf" "DockWebHTML"
  WriteRegStr SHCTX "Software\RegisteredApplications" "Dock Web" "$0\Capabilities"
!macroend

; Kept during an auto-update (the old version is uninstalled first) so the user's default-browser choice stays
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegKey SHCTX "Software\Classes\DockWebURL"
    DeleteRegKey SHCTX "Software\Classes\DockWebHTML"
    DeleteRegKey SHCTX "Software\Clients\StartMenuInternet\Dock Web"
    DeleteRegValue SHCTX "Software\RegisteredApplications" "Dock Web"
  ${endIf}
!macroend
