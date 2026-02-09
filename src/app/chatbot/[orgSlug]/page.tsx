/**
 * Chatbot UI Page
 *
 * This page renders inside an iframe in the embeddable widget.
 * It provides a chat interface for the chatbot intake process.
 *
 * @see PX-702 - Automated Chatbot Intake
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ChatbotClient from "./client";

interface PageProps {
  params: Promise<{
    orgSlug: string;
  }>;
  searchParams: Promise<{
    formId?: string;
    primaryColor?: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { name: true },
  });

  return {
    title: org ? `Chat with ${org.name}` : "Chat",
    description: "Complete your intake via chat",
  };
}

export default async function ChatbotPage({ params, searchParams }: PageProps) {
  const { orgSlug } = await params;
  const { formId, primaryColor } = await searchParams;

  // Fetch organization config
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      name: true,
      chatbotEnabled: true,
      chatbotFormId: true,
      chatbotAuthRequired: true,
      settings: true,
    },
  });

  if (!org) {
    notFound();
  }

  if (!org.chatbotEnabled) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Chat is not available
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This organization has not enabled chat intake.
          </p>
        </div>
      </div>
    );
  }

  const settings = (org.settings as Record<string, unknown>) || {};
  const effectiveColor = primaryColor || (settings.primaryColor as string) || "#4F46E5";
  const logoUrl = settings.logoUrl as string | undefined;

  return (
    <ChatbotClient
      orgSlug={orgSlug}
      orgName={org.name}
      formId={formId || org.chatbotFormId || undefined}
      primaryColor={effectiveColor}
      logoUrl={logoUrl}
    />
  );
}
