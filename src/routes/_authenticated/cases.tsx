import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import {
  FileText,
  FolderKanban,
  Plus,
  Printer,
  Trash2,
  X,
  PlusCircle,
  FileCheck,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import {
  addEventToCase,
  createCase,
  deleteCase,
  getCaseDetails,
  listCases,
  removeEventFromCase,
  updateCase,
} from "@/lib/cases.functions";
import { listEvents } from "@/lib/events.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/cases")({
  head: () => ({
    meta: [
      { title: "Investigative Case Management — HomeWatch" },
      {
        name: "description",
        content:
          "Organize camera detections, vehicle evidence, and investigator notes into exportable case packages for police reports or insurance claims.",
      },
      { property: "og:title", content: "Investigative Case Management — HomeWatch" },
      { property: "og:description", content: "Build incident folders and export evidence dossiers for law enforcement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CasesView,
});

function CasesView() {
  const queryClient = useQueryClient();
  const fetchCasesFn = useServerFn(listCases);
  const fetchCaseDetailsFn = useServerFn(getCaseDetails);
  const fetchRecentEventsFn = useServerFn(listEvents);
  const createCaseFn = useServerFn(createCase);
  const updateCaseFn = useServerFn(updateCase);
  const deleteCaseFn = useServerFn(deleteCase);
  const addEventFn = useServerFn(addEventToCase);
  const removeEventFn = useServerFn(removeEventFromCase);

  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);

  // New Case Form
  const [newTitle, setNewTitle] = useState("");
  const [newCaseNumber, setNewCaseNumber] = useState(`CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newDescription, setNewDescription] = useState("");

  // Event Attach Picker Search
  const [eventSearchQuery, setEventSearchQuery] = useState("");

  const casesQuery = useQuery({ queryKey: ["cases"], queryFn: () => fetchCasesFn({}) });

  const activeCaseQuery = useQuery({
    queryKey: ["case", activeCaseId],
    queryFn: () => (activeCaseId ? fetchCaseDetailsFn({ data: { id: activeCaseId } }) : Promise.resolve(null)),
    enabled: Boolean(activeCaseId),
  });

  const recentEventsQuery = useQuery({
    queryKey: ["recent-events-attach", eventSearchQuery],
    queryFn: () =>
      fetchRecentEventsFn({
        data: {
          limit: 30,
          ...(eventSearchQuery.trim() ? { naturalQuery: eventSearchQuery.trim() } : {}),
        },
      }),
    enabled: showAttachModal,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cases"] });
    if (activeCaseId) {
      queryClient.invalidateQueries({ queryKey: ["case", activeCaseId] });
    }
  };

  const handleCreateCase = useMutation({
    mutationFn: () =>
      createCaseFn({
        data: {
          title: newTitle,
          caseNumber: newCaseNumber,
          description: newDescription || null,
          status: "Open",
        },
      }),
    onSuccess: (created: any) => {
      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      setActiveCaseId(created.id);
      invalidate();
      toast.success("Incident Case folder created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleUpdateStatus = useMutation({
    mutationFn: (vars: { id: string; status: string; notes?: string }) =>
      updateCaseFn({
        data: {
          id: vars.id,
          status: vars.status,
          ...(vars.notes !== undefined ? { investigatorNotes: vars.notes } : {}),
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Case updated");
    },
  });

  const handleDeleteCase = useMutation({
    mutationFn: (id: string) => deleteCaseFn({ data: { id } }),
    onSuccess: () => {
      setActiveCaseId(null);
      invalidate();
      toast.success("Case deleted");
    },
  });

  const handleAttachEvent = useMutation({
    mutationFn: (eventId: string) =>
      addEventFn({
        data: {
          caseId: activeCaseId!,
          eventId,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Evidence event attached to case");
    },
  });

  const handleRemoveEvent = useMutation({
    mutationFn: (caseEventId: string) => removeEventFn({ data: { caseEventId } }),
    onSuccess: () => {
      invalidate();
      toast.success("Event removed from case");
    },
  });

  const activeCaseData = activeCaseQuery.data?.case;
  const attachedEvents = activeCaseQuery.data?.events ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Investigative Case Management</h1>
          <p className="text-sm text-muted-foreground">
            Package detections, notes, and vehicle evidence into incident dossiers for police reports or insurance claims.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Incident Case
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left Column: Cases List */}
        <div className="space-y-4">
          <Card className="bg-card/70 border border-border/70">
            <CardHeader className="py-3 px-4 border-b border-border/50">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  Incident Case Files
                </span>
                <Badge variant="secondary">{(casesQuery.data ?? []).length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {(casesQuery.data ?? []).length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No cases created yet. Click "Create Incident Case" to start building an evidence package.
                </p>
              ) : (
                (casesQuery.data ?? []).map((c) => {
                  const isSelected = activeCaseId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveCaseId(c.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-background/50 hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{c.case_number}</span>
                        <Badge
                          variant={
                            c.status === "Submitted to Police"
                              ? "destructive"
                              : c.status === "Closed"
                              ? "outline"
                              : "default"
                          }
                          className="text-[10px]"
                        >
                          {c.status}
                        </Badge>
                      </div>
                      <p className="font-semibold text-sm mt-1 text-foreground">{c.title}</p>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                        <span>{c.event_count} evidence item(s)</span>
                        <span>{format(new Date(c.created_at), "PP")}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 2 Columns: Selected Case Detail Dossier */}
        <div className="lg:col-span-2 space-y-4">
          {!activeCaseId ? (
            <Card className="bg-card/40 border border-border/40">
              <CardContent className="py-16 text-center text-sm text-muted-foreground space-y-2">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p>Select a case from the list to view evidence details, attach camera detections, or export a report.</p>
              </CardContent>
            </Card>
          ) : activeCaseQuery.isPending ? (
            <Card className="bg-card/40 border border-border/40">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Loading case dossier...
              </CardContent>
            </Card>
          ) : activeCaseData ? (
            <div className="space-y-6">
              {/* Dossier Header Card */}
              <Card className="bg-card/70 border border-border/70">
                <CardHeader className="py-4 px-6 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">{activeCaseData.case_number}</span>
                      <Badge variant="outline">{activeCaseData.status}</Badge>
                    </div>
                    <h2 className="text-xl font-bold mt-1">{activeCaseData.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created on {format(new Date(activeCaseData.created_at), "PPP p")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="mr-1.5 h-4 w-4" />
                      Print / PDF Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this entire case folder?")) {
                          handleDeleteCase.mutate(activeCaseData.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Status & Investigator Notes Editor */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Case Status</Label>
                      <Select
                        value={activeCaseData.status}
                        onValueChange={(val) =>
                          handleUpdateStatus.mutate({ id: activeCaseData.id, status: val })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open Investigation</SelectItem>
                          <SelectItem value="Under Review">Under Review</SelectItem>
                          <SelectItem value="Submitted to Police">Submitted to Police</SelectItem>
                          <SelectItem value="Insurance Claim Pending">Insurance Claim Pending</SelectItem>
                          <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Incident Description</Label>
                      <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded border border-border/50">
                        {activeCaseData.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  {/* Investigator Notes */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <Label htmlFor="notes" className="text-xs font-semibold">Investigator Notes & Narrative</Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      placeholder="Enter investigation notes, officer names, incident report reference numbers..."
                      defaultValue={activeCaseData.investigator_notes || ""}
                      onBlur={(e) =>
                        handleUpdateStatus.mutate({
                          id: activeCaseData.id,
                          status: activeCaseData.status,
                          notes: e.target.value,
                        })
                      }
                      className="text-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Evidence Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-primary" />
                    Attached Evidence ({attachedEvents.length})
                  </h3>
                  <Button size="sm" onClick={() => setShowAttachModal(true)}>
                    <PlusCircle className="mr-1.5 h-4 w-4" />
                    Attach Detection Event
                  </Button>
                </div>

                {attachedEvents.length === 0 ? (
                  <Card className="bg-card/40 border border-border/40">
                    <CardContent className="py-8 text-center text-xs text-muted-foreground space-y-2">
                      <p>No detection evidence attached yet.</p>
                      <Button size="sm" variant="outline" onClick={() => setShowAttachModal(true)}>
                        Browse & Attach Camera Detections
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {attachedEvents.map((item: any, idx: number) => {
                      const ev = item.event;
                      return (
                        <Card key={item.case_event_id} className="overflow-hidden bg-card/70 border border-border/60">
                          {ev.imageUrl ? (
                            <div className="relative aspect-video w-full bg-slate-950">
                              <img src={ev.imageUrl} alt={ev.summary} className="h-full w-full object-cover" />
                              <div className="absolute top-2 left-2 bg-primary text-primary-foreground font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Evidence #{idx + 1}
                              </div>
                            </div>
                          ) : null}
                          <CardContent className="p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              {ev.plate_text ? (
                                <span className="plate rounded bg-secondary px-2 py-0.5 font-bold text-xs">
                                  {ev.plate_text} {ev.plate_state ? `(${ev.plate_state})` : ""}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">no plate</span>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {ev.camera_name}
                              </Badge>
                            </div>
                            <p className="font-semibold text-foreground">
                              {[ev.vehicle_color, ev.vehicle_make, ev.vehicle_model].filter(Boolean).join(" ") || "Detection"}
                            </p>
                            {ev.unique_features?.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {ev.unique_features.map((f: string) => (
                                  <span key={f} className="bg-primary/10 text-primary text-[10px] px-1 py-0.2 rounded">
                                    #{f.replace("_", " ")}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <p className="text-muted-foreground text-[11px]">{ev.summary}</p>
                            <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                              <span>{format(new Date(ev.captured_at), "PP p")}</span>
                              <button
                                onClick={() => handleRemoveEvent.mutate(item.case_event_id)}
                                className="text-destructive hover:underline no-print"
                              >
                                Detach
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Official Verification & Sign-off Block for Print / PDF Export */}
              <Card className="bg-card/40 border border-border/50 p-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
                  Official Verification & Evidence Attestation
                </h4>
                <div className="grid gap-6 sm:grid-cols-2 text-xs">
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-[11px]">
                      I hereby certify that the evidence photos, license plate records, and camera timestamps attached to dossier <strong className="font-mono">{activeCaseData.case_number}</strong> were captured automatically by the HomeWatch camera security system.
                    </p>
                    <div className="pt-4 border-b border-muted-foreground/40">
                      <p className="text-[10px] text-muted-foreground">Reporting Resident / Security Officer Signature</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="text-[11px] space-y-1 text-muted-foreground">
                      <p><strong>System ID:</strong> HOMEWATCH-ALPR-SYS-1</p>
                      <p><strong>Total Attached Detections:</strong> {attachedEvents.length}</p>
                      <p><strong>Dossier Export Date:</strong> {format(new Date(), "PPP p")}</p>
                    </div>
                    <div className="pt-4 border-b border-muted-foreground/40">
                      <p className="text-[10px] text-muted-foreground">Date Signed</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      {/* Modal 1: Create Case Dialog */}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-card border border-border shadow-2xl">
            <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">New Incident Case Folder</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="c-num">Case Number</Label>
                <Input
                  id="c-num"
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-title">Incident Title</Label>
                <Input
                  id="c-title"
                  placeholder="e.g. Package Theft on Main Driveway"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-desc">Description</Label>
                <Textarea
                  id="c-desc"
                  rows={3}
                  placeholder="Briefly describe what occurred..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleCreateCase.mutate()} disabled={!newTitle || handleCreateCase.isPending}>
                  Create Folder
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Modal 2: Attach Evidence Event Picker */}
      {showAttachModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl bg-card border border-border shadow-2xl max-h-[85vh] flex flex-col">
            <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Attach Camera Evidence Event</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowAttachModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              <Input
                placeholder="Search by plate, color, vehicle description..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="text-xs"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                {(recentEventsQuery.data ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-col justify-between p-2.5 rounded border border-border/60 bg-background/50 hover:bg-secondary/40"
                  >
                    <div>
                      {ev.imageUrl ? (
                        <img src={ev.imageUrl} alt={ev.summary} className="aspect-video w-full rounded object-cover mb-2" />
                      ) : null}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="plate rounded bg-secondary px-1.5 py-0.5 text-[11px]">
                          {ev.plate_text || "no plate"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{ev.camera_name}</span>
                      </div>
                      <p className="text-[11px] font-semibold">
                        {[ev.vehicle_color, ev.vehicle_make, ev.vehicle_model].filter(Boolean).join(" ")}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{ev.summary}</p>
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 text-xs"
                      onClick={() => handleAttachEvent.mutate(ev.id)}
                    >
                      Attach to Case
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
