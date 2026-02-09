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
  Pencil,
  Plus,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { FormSelectionModal } from "@/components/calls/form-selection-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { RequestPhoneButton } from "./request-phone-button";
import { MessageList, SmsPreferenceCard, MessageComposer } from "@/components/messaging";
import { NoteDrawer, NoteDetailDrawer, NotesFilterBar, getTagColor } from "@/components/notes";
import { useClientNotes, type ClientNote, type NotesFilters } from "@/hooks/use-client-notes";
import { cn } from "@/lib/utils";

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

// Note interface is now imported from use-client-notes hook

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
  const [recentNotes, setRecentNotes] = useState<ClientNote[]>([]);
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

  // Notes state
  const [showNoteDrawer, setShowNoteDrawer] = useState(false);
  const [showNoteDetailDrawer, setShowNoteDetailDrawer] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ClientNote | null>(null);
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Notes filter state
  const [notesFilters, setNotesFilters] = useState<NotesFilters>({
    tags: [],
    startDate: null,
    endDate: null,
    search: "",
  });

  // Use the client notes hook for filtered/paginated notes
  const {
    notes: filteredNotes,
    isLoading: isLoadingNotes,
    error: notesError,
    hasMore: hasMoreNotes,
    refetch: refetchNotes,
    loadMore: loadMoreNotes,
  } = useClientNotes({
    clientId,
    filters: notesFilters,
    enabled: activeTab === "notes",
  });

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

  // Fetch current user ID for notes ownership
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch("/api/users/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data.data?.id || null);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [clientRes, callsRes, notesRes, formsRes, smsRes, messagesRes] = await Promise.all([
          fetch(`/api/clients/${clientId}`),
          fetch(`/api/clients/${clientId}/calls?limit=10`),
          fetch(`/api/clients/${clientId}/notes?limit=3`), // Only fetch a few for overview
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
          // Handle both array and paginated response formats
          const notesData = Array.isArray(data.data) ? data.data : (data.data?.notes || []);
          setRecentNotes(notesData);
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
          <TabsTrigger value="notes">Notes ({client._count?.notes || 0})</TabsTrigger>
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
                {recentNotes.slice(0, 2).map((note) => (
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
                {calls.length === 0 && recentNotes.length === 0 && (
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
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Notes</CardTitle>
                <CardDescription>Internal notes and documentation</CardDescription>
              </div>
              <Button size="sm" onClick={() => {
                setEditingNote(null);
                setShowNoteDrawer(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter Bar */}
              <NotesFilterBar
                selectedTags={notesFilters.tags || []}
                onTagsChange={(tags) => setNotesFilters((prev) => ({ ...prev, tags }))}
                dateRange={{
                  from: notesFilters.startDate || null,
                  to: notesFilters.endDate || null,
                }}
                onDateRangeChange={(range) =>
                  setNotesFilters((prev) => ({
                    ...prev,
                    startDate: range.from,
                    endDate: range.to,
                  }))
                }
                searchQuery={notesFilters.search || ""}
                onSearchChange={(search) => setNotesFilters((prev) => ({ ...prev, search }))}
                onClearFilters={() =>
                  setNotesFilters({
                    tags: [],
                    startDate: null,
                    endDate: null,
                    search: "",
                  })
                }
              />

              {/* Notes List */}
              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notesError ? (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{notesError}</p>
                  <Button variant="outline" size="sm" onClick={refetchNotes} className="mt-2">
                    Try Again
                  </Button>
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {(notesFilters.tags?.length || notesFilters.search || notesFilters.startDate)
                      ? "No notes match your filters"
                      : "No notes yet"}
                  </p>
                  {!notesFilters.tags?.length && !notesFilters.search && !notesFilters.startDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingNote(null);
                        setShowNoteDrawer(true);
                      }}
                      className="mt-2"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add your first note
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredNotes.map((note) => {
                    const wasEdited = note.createdAt !== note.updatedAt;
                    const isAuthor = currentUserId === note.author.id;

                    return (
                      <div
                        key={note.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedNote(note);
                          setShowNoteDetailDrawer(true);
                        }}
                      >
                        {/* Header row: Author + Date */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {note.author?.name || note.author?.email}
                            </span>
                            {isAuthor && (
                              <span className="text-xs text-muted-foreground">(you)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {wasEdited && (
                              <span className="flex items-center gap-1">
                                <Pencil className="h-3 w-3" />
                                edited
                              </span>
                            )}
                            <span>{format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}</span>
                          </div>
                        </div>

                        {/* Tags row */}
                        {note.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {note.tags.map((tag) => (
                              <span
                                key={tag}
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                                  getTagColor(tag)
                                )}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Content preview */}
                        <div
                          className="text-sm text-muted-foreground line-clamp-2 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: note.content.substring(0, 200) + (note.content.length > 200 ? "..." : ""),
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Load More */}
                  {hasMoreNotes && (
                    <div className="text-center pt-2">
                      <Button variant="outline" size="sm" onClick={loadMoreNotes}>
                        Load more notes
                      </Button>
                    </div>
                  )}
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

      {/* Note Drawer - Create/Edit */}
      <NoteDrawer
        open={showNoteDrawer}
        onOpenChange={setShowNoteDrawer}
        clientId={clientId}
        note={editingNote ? {
          id: editingNote.id,
          content: editingNote.content,
          type: editingNote.type,
          status: editingNote.status,
          tags: editingNote.tags,
          isDraft: editingNote.isDraft,
          authorId: editingNote.author.id,
          createdAt: editingNote.createdAt,
          updatedAt: editingNote.updatedAt,
          rejectionReason: editingNote.rejectionReason,
          author: editingNote.author,
        } : null}
        onSave={() => {
          // Refetch notes after saving
          refetchNotes();
          setShowNoteDrawer(false);
          setEditingNote(null);
        }}
      />

      {/* Note Detail Drawer - Read-only View */}
      <NoteDetailDrawer
        note={selectedNote}
        open={showNoteDetailDrawer}
        onOpenChange={setShowNoteDetailDrawer}
        currentUserId={currentUserId || undefined}
        onEdit={(note) => {
          // Close detail drawer and open edit drawer
          setShowNoteDetailDrawer(false);
          setEditingNote(note);
          setShowNoteDrawer(true);
        }}
      />
    </div>
  );
}
