"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "@/lib/site";

/**
 * A client island only because the shadcn accordion is built on base-ui, which
 * needs the client. The questions and answers still arrive in the server HTML —
 * a client component is server-rendered too — so the `FAQPage` structured data
 * on the page has visible copy backing every entry, which is what Google
 * requires of it.
 *
 * `multiple={false}` keeps the section short: one answer at a time means the
 * page never grows into a wall of text under the reader. (Base UI names this
 * prop `multiple`, not Radix's `type="single"`.)
 */
export function LandingFaq() {
  return (
    <Accordion
      multiple={false}
      defaultValue={[]}
      className="rounded-xl border bg-card px-5"
    >
      {FAQS.map(({ question, answer }) => (
        <AccordionItem key={question} value={question}>
          <AccordionTrigger className="py-4 text-base">
            {question}
          </AccordionTrigger>
          <AccordionContent className="pb-4 text-muted-foreground">
            {answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
