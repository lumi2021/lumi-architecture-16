let editor;
const breakpoints = new Set();
let breakpointDecorations = [];

async function main() {
    editor = await setupMonaco();

}

function loadMonaco() {
    return new Promise((resolve, reject) => {
        require.config({
            paths: {
                vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"
            }
        });

        require(
            ["vs/editor/editor.main"],
            resolve,
            reject
        );
    });
}

async function setupMonaco() {
    await loadMonaco();

    monaco.languages.register({
        id: "la16-assembly"
    });

    monaco.languages.setMonarchTokensProvider("la16-assembly", {
        tokenizer: {
            root: [
                [/;.*$/, "comment"],

                [/\b(0x[0-9a-fA-F]+|\d+)\b/, "number"],
                [/\b(R[0-9]+|PC|SP|FLAGS)\b/, "variable"],
                [/[a-zA-Z_][a-zA-Z0-9_]*(?=:)/, "type.identifier"],
                [/[,:[\]]/, "delimiter"],

                // macros
                [/\b(define|org|dw)\b/, "keyword"],

                // instructions
                [/\b(hlt|nop|lda|sta|mov|add|addc|sub|subc)\b/i, "keyword"],
                [/\b(and|or|xor|not|cmp|push|pusha|pop|popa)\b/i, "keyword"],
                [/\b(br|brz|brnz|brn|brp|brc|brnc|bro|brno|bri)\b/i, "keyword"],
                [/\b(call|int|iret)\b/i, "keyword"],
            ]
        }
    });

    const response = await fetch("/example.la16");
    const source = await response.text();

    const asm = monaco.editor.createModel(
        source,
        "la16-assembly",
        monaco.Uri.parse("/example.la16")
    );

    const editor = monaco.editor.create(
        document.getElementById("editor"),
        {
            model: asm,
            theme: "vs-dark",

            fontFamily: "JetBrains Mono",
            fontSize: 14,

            glyphMargin: true,
        }
    );

    editor.onMouseDown(event => {
        const type = event.target.type;

        if (
            type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
            type !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
        ) return;

        const line = event.target.position?.lineNumber;

        if (!line) return;

        if (breakpoints.has(line)) breakpoints.delete(line);
        else breakpoints.add(line);

        updateBreakpoints();
    });

    return editor;
}
function updateBreakpoints() {
    breakpointDecorations = editor.deltaDecorations(
        breakpointDecorations,

        [...breakpoints].map(line => ({
            range: new monaco.Range(line, 1, line, 1),

            options: {
                glyphMarginClassName: "breakpoint"
            }
        }))
    );
}

main();
