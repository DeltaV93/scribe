import { redirect, notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ConversionFlow } from "./conversion-flow"

interface PageProps {
  params: Promise<{ formId: string }>
  searchParams: Promise<{ clientId?: string }>
}

export default async function FormConversionPage({
  params,
  searchParams,
}: PageProps) {
  const user = await getCurrentUser()
  const { formId } = await params
  const { clientId } = await searchParams

  if (!user) {
    redirect("/login")
  }

  // Get form with fields
  const form = await prisma.form.findFirst({
    where: {
      id: formId,
      orgId: user.orgId,
    },
    include: {
      fields: {
        where: { isAiExtractable: true },
        orderBy: { order: "asc" },
      },
    },
  })

  if (!form) {
    notFound()
  }

  // Get client if specified
  let client = null
  if (clientId) {
    client = await prisma.client.findFirst({
      where: {
        id: clientId,
        orgId: user.orgId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    })
  }

  return (
    <div className="container py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Convert Document to Form Data</h1>
        <p className="text-muted-foreground">
          Upload a photo or PDF to extract data for{" "}
          <span className="font-medium">{form.name}</span>
          {client && (
            <>
              {" "}
              for client{" "}
              <span className="font-medium">
                {client.firstName} {client.lastName}
              </span>
            </>
          )}
        </p>
      </div>

      <ConversionFlow
        formId={form.id}
        formName={form.name}
        fields={form.fields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          isRequired: f.isRequired,
        }))}
        clientId={clientId}
        clientName={client ? `${client.firstName} ${client.lastName}` : undefined}
      />
    </div>
  )
}
