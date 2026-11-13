' guardian-aspel.vbs - Portal Operativo Tecnocontrol (13-nov-2026)
' Arranca guardian-aspel.js SIN ventana. Si ya hay un guardian corriendo, el nuevo se sale solo.
Option Explicit
Dim fso, sh, carpeta, nodo
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
nodo = carpeta & "\node\node.exe"
If Not fso.FileExists(nodo) Then nodo = "node"
sh.CurrentDirectory = carpeta
sh.Run """" & nodo & """ """ & carpeta & "\guardian-aspel.js""", 0, False
