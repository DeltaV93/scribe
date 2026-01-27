"use client";

import { useRouter, useParams } from "next/navigation";
import { usePortalSession } from "@/components/portal/portal-session-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, ArrowLeft, Mail, Lock, MessageSquare, GraduationCap } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    question: "How do I access the portal?",
    answer:
      "You access the portal through a secure link sent to your phone via text message. Each link is valid for 24 hours. If your link expires, contact your case manager for a new one.",
    icon: Mail,
  },
  {
    question: "What is a PIN and do I need one?",
    answer:
      "A PIN is an optional 4-digit code that adds extra security to your account. If you set a PIN, you will need to enter it when returning to the portal. Your case manager's magic link will always let you in without the PIN. You can set, change, or remove your PIN in Settings.",
    icon: Lock,
  },
  {
    question: "How do I send a message?",
    answer:
      "Go to the Messages tab and type your message in the text box at the bottom. Press Enter or tap the send button to send. Your case manager will receive a notification about your message.",
    icon: MessageSquare,
  },
  {
    question: "How do I check my program progress?",
    answer:
      "Go to the Programs tab to see all programs you are enrolled in. Each program shows your progress including hours completed and sessions attended. The progress bar shows how close you are to completing the program requirements.",
    icon: GraduationCap,
  },
  {
    question: "What if I change my phone number?",
    answer:
      "You can update your phone number in Settings. You will need to verify your new number with a code sent via text. After changing your number, you will need to sign in again with a new magic link sent to your new number.",
    icon: Mail,
  },
  {
    question: "What are SMS notifications?",
    answer:
      "When enabled, you will receive a text message alert whenever your case manager sends you a new message. You can turn this on or off in Settings. The text will contain a link to view the message securely.",
    icon: MessageSquare,
  },
  {
    question: "Is my information secure?",
    answer:
      "Yes. All messages are encrypted. Your portal link is unique to you and expires after 24 hours. Never share your portal link with anyone else. If you suspect unauthorized access, contact your case manager immediately.",
    icon: Lock,
  },
  {
    question: "Who do I contact for help?",
    answer:
      "For any questions or issues with the portal, please contact your case manager directly. They can send you a new access link, answer questions about your programs, and help with any technical issues.",
    icon: HelpCircle,
  },
];

export default function HelpPage() {
  const params = useParams();
  const token = params.token as string;
  const { session } = usePortalSession();

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href={`/portal/${token}/settings`}>
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <HelpCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Help & FAQ</h1>
          <p className="text-xs text-muted-foreground">
            Common questions and answers
          </p>
        </div>
      </div>

      {/* FAQs */}
      <Card>
        <CardContent className="pt-6">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => {
              const Icon = faq.icon;
              return (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{faq.question}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pl-7">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need More Help?</CardTitle>
          <CardDescription>
            Contact your case manager at {session?.client.organization || "your organization"} for
            personalized assistance.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Security Note */}
      <p className="text-xs text-center text-muted-foreground px-4">
        Remember: Never share your portal link with anyone. Your case manager will never ask for
        your PIN.
      </p>
    </div>
  );
}
