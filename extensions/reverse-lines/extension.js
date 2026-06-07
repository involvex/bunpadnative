import * as vscode from "vscode";

/** Sample VS Code-compatible extension for BunPad. */
export function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "reverseLines.reverse",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showWarningMessage("No active editor.");
        return;
      }

      const lines = editor.document.getText().split(/\r?\n/);
      const reversed = lines.reverse().join("\n");
      const lastLine = Math.max(0, editor.document.lineCount - 1);
      const lastCharacter = editor.document.lineAt(lastLine).text.length;
      const fullRange = new vscode.Range(0, 0, lastLine, lastCharacter);

      const ok = await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, reversed);
      });

      if (ok) {
        await vscode.window.showInformationMessage("Lines reversed.");
      }
    },
  );

  context.subscriptions.push(disposable);
}
