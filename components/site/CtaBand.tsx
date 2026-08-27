import { ArrowRight } from "lucide-react";
import Button from "@/components/site/Button";

/**
 * The closing call to action every public page ends on.
 *
 * One component rather than a copy per page: the pair of buttons is the site's
 * conversion path, and six near-identical hand-written copies is how the
 * secondary link quietly stops matching the primary one.
 */
export default function CtaBand({
    heading = "Start with a structure that is actually yours",
    body = "Create a workspace, name your own modules and columns, and invite the people who work in them. No credit card, no imposed pipeline.",
}: {
    heading?: string;
    body?: string;
}) {
    return (
        <section className="border-t border-slate-200 bg-card">
            <div className="mx-auto w-full max-w-4xl px-6 py-14 text-center sm:px-10 sm:py-16">
                <h2 className="font-google-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {heading}
                </h2>

                <p className="mx-auto mt-4 max-w-xl text-sm text-muted sm:text-base">{body}</p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button href="/register" size="lg">
                        Create your workspace
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button href="/contact" variant="secondary" size="lg">
                        Talk to us first
                    </Button>
                </div>
            </div>
        </section>
    );
}
