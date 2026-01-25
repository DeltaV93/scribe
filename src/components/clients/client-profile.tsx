"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientStatusBadge } from "./client-status-badge";
import { ClientStatus } from "@prisma/client";
import {
  Phone,
  Mail,
  MapPin,
  Edit,
  PhoneCall,
  FileText,
  MessageSquare,
  Clock,
  User,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { FormSelectionModal } from "@/components/calls/form-selection-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { RequestPhoneButton } from "./request-phone-button";
import { MessageList, SmsPreferenceCard, MessageComposer } from "@/components/messaging";

interface ClientAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: ClientAddress | null;
  internalId: string | null;
  status: ClientStatus;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  _count?: {
    calls: number;
    notes: number;
    formSubmissions: number;
  };
}

interface Call {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  caseManager?: {
    name: string | null;
    email: string;
  };
}

interface Note {
  id: string;
  content: string;
  type: string;
  tags: string[];
  createdAt: string;
  author?: {
    name: string | null;
    email: string;
  };
}

interface FormSubmission {
  id: string;
  status: string;
  createdAt: string;
  form?: {
    id: string;
    name: string;
    type: string;
  };
}

interface ClientProfileProps {
  clientId: string;
}

export function ClientProfile({ clientId }: ClientProfileProps) {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCallModal, setShowCallModal] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const [clientLock, setClientLock] = useState<{
    locked: boolean;
    lockedBy?: string;
    isOwnLock?: boolean;
  } | null>(null);
  const [isCheckingLock, setIsCheckingLock] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<{
    hasPhoneNumber: boolean;
    phoneNumber: string | null;
    hasPendingRequest: boolean;
    requestId: string | null;
  } | null>(null);
  const [isLoadingPhoneStatus, setIsLoadingPhoneStatus] = useState(true);
  const [smsOptedIn, setSmsOptedIn] = useState(false);
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  // Check if client is locked before showing call modal
  const checkClientLock = useCallback(async () => {
    setIsCheckingLock(true);
    try {
      const params = new URLSearchParams({
        resourceType: "client",
        resourceId: clientId,
      });
      const response = await fetch(`/api/locks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClientLock(data.data);
        return data.data;
      }
    } catch (error) {
      console.error("Error checking lock:", error);
    } finally {
      setIsCheckingLock(false);
    }
    return null;
  }, [clientId]);

  const handleCallClick = async () => {
    const lockStatus = await checkClientLock();
    if (lockStatus?.locked && !lockStatus?.isOwnLock) {
      toast.error(`${lockStatus.lockedBy || "Another user"} is currently on a call with this client`);
      return;
    }
    setShowCallModal(true);
  };

  // Fetch user's phone status
  useEffect(() => {
    const fetchPhoneStatus = async () => {
      setIsLoadingPhoneStatus(true);
      try {
        const response = await fetch("/api/phone-numbers/my-status");
        if (response.ok) {
          const data = await response.json();
          setPhoneStatus(data.data);
        }
      } catch (error) {
        console.error("Error fetching phone status:", error);
      } finally {
        setIsLoadingPhoneStatus(false);
      }
    };

    fetchPhoneStatus();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [clientRes, callsRes, notesRes, formsRes, smsRes, messagesRes] = await Promise.all([
          fetch(`/api/clients/${clientId}`),
          fetch(`/api/clients/${clientId}/calls?limit=10`),
          fetch(`/api/clients/${clientId}/notes`),
          fetch(`/api/clients/${clientId}/forms`),
          fetch(`/api/clients/${clientId}/sms-preference`),
          fetch(`/api/clients/${clientId}/messages?limit=1`),
        ]);

        if (clientRes.ok) {
          const data = await clientRes.json();
          setClient(data.data);
        }

        if (callsRes.ok) {
          const data = await callsRes.json();
          setCalls(data.data);
        }

        if (notesRes.ok) {
          const data = await notesRes.json();
          setNotes(data.data);
        }

        if (formsRes.ok) {
          const data = await formsRes.json();
          setForms(data.data);
        }

        if (smsRes.ok) {
          const data = await smsRes.json();
          setSmsOptedIn(data.data?.optedIn || false);
        }

        if (messagesRes.ok) {
          const data = await messagesRes.json();
          setMessageCount(data.data?.pagination?.total || 0);
        }
      } catch (error) {
        console.error("Error fetching client data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [clientId]);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleInitiateCall = async (formIds: string[]) => {
    setIsInitiatingCall(true);
    try {
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, formIds }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/calls/${data.data.id}`);
      } else {
        console.error("Failed to initiate call");
      }
    } catch (error) {
      console.error("Error initiating call:", error);
    } finally {
      setIsInitiatingCall(false);
      setShowCallModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {client.firstName} {client.lastName}
            </h1>
            <ClientStatusBadge status={client.status} />
          </div>
          {client.internalId && (
            <p className="text-sm text-muted-foreground">ID: {client.internalId}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/clients/${clientId}/edit`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setShowMessageComposer(true)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
          </Button>
          {isLoadingPhoneStatus ? (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </Button>
          ) : phoneStatus?.hasPhoneNumber ? (
            <Button onClick={handleCallClick} disabled={isCheckingLock}>
              {isCheckingLock ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PhoneCall className="mr-2 h-4 w-4" />
              )}
              Call
            </Button>
          ) : (
            <RequestPhoneButton
              hasPendingRequest={phoneStatus?.hasPendingRequest || false}
              requestId={phoneStatus?.requestId}
              onRequestCreated={() => {
                // Refresh phone status after request
                fetch("/api/phone-numbers/my-status")
                  .then(res => res.json())
                  .then(data => setPhoneStatus(data.data))
                  .catch(console.error);
              }}
            />
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{client._count?.calls || 0}</div>
            <p className="text-sm text-muted-foreground">Total Calls</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{client._count?.formSubmissions || 0}</div>
            <p className="text-sm text-muted-foreground">Forms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{client._count?.notes || 0}</div>
            <p className="text-sm text-muted-foreground">Notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium">
              {formatDistanceToNow(new Date(client.updatedAt), { addSuffix: true })}
            </div>
            <p className="text-sm text-muted-foreground">Last Updated</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="messages">Messages ({messageCount})</TabsTrigger>
          <TabsTrigger value="calls">Calls ({calls.length})</TabsTrigger>
          <TabsTrigger value="forms">Forms ({forms.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{formatPhone(client.phone)}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>
                      {client.address.street}
                      <br />
                      {client.address.city}, {client.address.state} {client.address.zip}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned To */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Case Manager</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{client.assignedUser?.name || client.assignedUser?.email}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {calls.slice(0, 3).map((call) => (
                  <div key={call.id} className="flex items-start gap-3">
                    <PhoneCall className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Call - {call.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
                {notes.slice(0, 2).map((note) => (
                  <div key={note.id} className="flex items-start gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {note.content.replace(/<[^>]*>/g, "").substring(0, 50)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(note.createdAt), "MMM d, yyyy")} by {note.author?.name || note.author?.email}
                      </p>
                    </div>
                  </div>
                ))}
                {calls.length === 0 && notes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <MessageList
                clientId={clientId}
                clientName={`${client.firstName} ${client.lastName}`}
                smsEnabled={smsOptedIn}
              />
            </div>
            <div>
              <SmsPreferenceCard
                clientId={clientId}
                clientPhone={client.phone}
                onPreferenceChange={(optedIn) => setSmsOptedIn(optedIn)}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Call History</CardTitle>
              <CardDescription>Recent documented calls with this client</CardDescription>
            </CardHeader>
            <CardContent>
              {calls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No calls recorded yet</p>
              ) : (
                <div className="space-y-4">
                  {calls.map((call) => (
                    <div
                      key={call.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/calls/${call.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <PhoneCall className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{call.status}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                      {call.durationSeconds && (
                        <span className="text-sm text-muted-foreground">
                          {Math.floor(call.durationSeconds / 60)}:{(call.durationSeconds % 60).toString().padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Form Submissions</CardTitle>
              <CardDescription>Forms completed for this client</CardDescription>
            </CardHeader>
            <CardContent>
              {forms.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No forms submitted yet</p>
              ) : (
                <div className="space-y-4">
                  {forms.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{submission.form?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(submission.createdAt), "MMM d, yyyy")} - {submission.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Notes</CardTitle>
                <CardDescription>Internal notes and documentation</CardDescription>
              </div>
              <Button size="sm">
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No notes yet</p>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {note.author?.name || note.author?.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <div
                        className="text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: note.content }}
                      />
                      {note.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {note.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FormSelectionModal
        open={showCallModal}
        onOpenChange={setShowCallModal}
        onConfirm={handleInitiateCall}
        clientName={`${client.firstName} ${client.lastName}`}
        isLoading={isInitiatingCall}
      />

      <MessageComposer
        clientId={clientId}
        clientName={`${client.firstName} ${client.lastName}`}
        smsEnabled={smsOptedIn}
        open={showMessageComposer}
        onOpenChange={setShowMessageComposer}
        onMessageSent={() => {
          // Refresh message count
          fetch(`/api/clients/${clientId}/messages?limit=1`)
            .then((res) => res.json())
            .then((data) => setMessageCount(data.data?.pagination?.total || 0))
            .catch(console.error);
        }}
      />
    </div>
  );
}
