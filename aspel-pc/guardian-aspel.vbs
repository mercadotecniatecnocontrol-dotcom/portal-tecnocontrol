' guardian-aspel.vbs - Portal Operativo Tecnocontrol (13-nov-2026, v2)
' Arranca guardian-aspel.js SIN ventana. Si ya hay un guardian corriendo, el nuevo se sale solo.
' v2: busca node.exe en varios lugares (carpeta node\, el que usa arrancar-vigilante.bat,
'     instalaciones comunes) y si no, lo lanza con cmd usando el PATH, igual que los .bat.
Option Explicit
Dim fso, sh, carpeta, nodo, js, cands, c, txt, m, re
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
js = carpeta & "\guardian-aspel.js"
nodo = ""

' 1) Ruta de node.exe escrita dentro de los .bat existentes
For Each c In Array("arrancar-vigilante.bat", "iniciar-sincronizador-aspel.bat", "iniciar-sincronizador-partidas.bat")
  If nodo = "" And fso.FileExists(carpeta & "\" & c) Then
    txt = fso.OpenTextFile(carpeta & "\" & c, 1).ReadAll
    Set re = New RegExp: re.IgnoreCase = True: re.Pattern = "([A-Za-z]:\\[^""\r\n]*?node\.exe)"
    If re.Test(txt) Then
      Set m = re.Execute(txt)
      If fso.FileExists(m(0).SubMatches(0)) Then nodo = m(0).SubMatches(0)
    End If
  End If
Next

' 2) Lugares comunes
If nodo = "" Then
  cands = Array(carpeta & "\node\node.exe", _
    sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\node\node.exe", _
    sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Programs\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
    sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe")
  For Each c In cands
    If nodo = "" And fso.FileExists(c) Then nodo = c
  Next
End If

sh.CurrentDirectory = carpeta
If nodo <> "" Then
  sh.Run """" & nodo & """ """ & js & """", 0, False
Else
  ' 3) Igual que los .bat: "node" desde el PATH, a traves de cmd (oculto)
  sh.Run "cmd.exe /c node """ & js & """", 0, False
End If
