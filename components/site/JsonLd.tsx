/**
 * A structured-data block.
 *
 * The `<` escape is not optional and not decoration: JSON.stringify happily
 * emits a literal `</script>` if any string in the graph contains one, which
 * closes the tag early and drops the rest of the page's markup into the
 * document. Next's own JSON-LD guide specifies exactly this replace.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(data).replace(/</g, "\u003c"),
            }}
        />
    );
}
