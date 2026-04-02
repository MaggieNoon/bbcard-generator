import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Linkedin,
  Download,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileSliders,
  Clock,
  CheckCircle,
  XCircle,
  User,
  FileText,
  Upload,
} from "lucide-react";

interface ExperienceEntry {
  dateRange: string;
  company: string;
  title: string;
  isSubRole?: boolean;
}

interface EducationEntry {
  school: string;
  degree: string;
  honors?: string;
}

interface CardJob {
  id: number;
  linkedinUrl: string;
  name?: string;
  title?: string;
  company?: string;
  location?: string;
  companyLocation?: string;
  companyType?: string;
  companyDescription?: string;
  experience?: string;
  education?: string;
  status: "pending" | "processing" | "done" | "error";
  errorMessage?: string;
  pptxPath?: string;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "done") return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Ready</Badge>;
  if (status === "error") return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
  if (status === "processing") return <Badge className="bg-blue-100 text-blue-800 border-blue-200 status-pulse"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
  return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
}

function CardStatusPoller({ cardId, onDone }: { cardId: number; onDone: () => void }) {
  const { data } = useQuery<CardJob>({
    queryKey: ["/api/cards", cardId],
    queryFn: () => apiRequest("GET", `/api/cards/${cardId}`).then(r => r.json()),
    refetchInterval: (data: any) => {
      if (!data || data.status === "processing" || data.status === "pending") return 2000;
      return false;
    },
    staleTime: 0,
  });

  if (!data) return null;

  if (data.status === "done") {
    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-800">Baseball card ready!</p>
            <p className="text-sm text-green-700">{data.name} — {data.company}</p>
          </div>
          <a
            href={`/api/cards/${cardId}/download`}
            target="_blank"
            rel="noreferrer"
            data-testid="download-link"
          >
            <Button className="bg-[#142137] hover:bg-[#1e3050] text-white">
              <Download className="w-4 h-4 mr-2" />
              Download PPTX
            </Button>
          </a>
        </div>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="font-semibold text-red-800">Generation failed</p>
        <p className="text-sm text-red-700 mt-1">{data.errorMessage}</p>
        <p className="text-xs text-red-600 mt-2">Try using the manual data entry tab instead.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      <div>
        <p className="font-semibold text-blue-800">Generating baseball card…</p>
        <p className="text-sm text-blue-700">This usually takes 10–30 seconds</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // LinkedIn URL tab state
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [activeCardId, setActiveCardId] = useState<number | null>(null);

  // Manual entry state
  const [manualName, setManualName] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualCompanyLocation, setManualCompanyLocation] = useState("");
  const [manualCompanyType, setManualCompanyType] = useState("");
  const [manualCompanyDesc, setManualCompanyDesc] = useState("");
  const [manualPhoto, setManualPhoto] = useState<File | null>(null);
  const [manualLogo, setManualLogo] = useState<File | null>(null);
  const [manualExperience, setManualExperience] = useState<ExperienceEntry[]>([
    { dateRange: "", company: "", title: "" },
  ]);
  const [manualEducation, setManualEducation] = useState<EducationEntry[]>([
    { school: "", degree: "", honors: "" },
  ]);
  const [manualCardId, setManualCardId] = useState<number | null>(null);

  // Resume tab state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeCardId, setResumeCardId] = useState<number | null>(null);
  const [resumeDragOver, setResumeDragOver] = useState(false);

  // History
  const { data: allCards } = useQuery<CardJob[]>({
    queryKey: ["/api/cards"],
    queryFn: () => apiRequest("GET", "/api/cards").then(r => r.json()),
    refetchInterval: 5000,
  });

  // LinkedIn mutation
  const linkedinMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/cards", { linkedinUrl: url });
      return res.json();
    },
    onSuccess: (data: CardJob) => {
      setActiveCardId(data.id);
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Manual mutation
  const manualMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      const candidateData = {
        name: manualName,
        title: manualTitle,
        company: manualCompany,
        location: manualLocation,
        companyLocation: manualCompanyLocation,
        companyType: manualCompanyType,
        companyDescription: manualCompanyDesc,
        experience: manualExperience.filter(e => e.company || e.title),
        education: manualEducation.filter(e => e.school),
      };
      formData.append("data", JSON.stringify(candidateData));
      if (manualPhoto) formData.append("photo", manualPhoto);
      if (manualLogo) formData.append("logo", manualLogo);

      const res = await fetch("/api/cards/manual", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to create card");
      return res.json();
    },
    onSuccess: (data: CardJob) => {
      setManualCardId(data.id);
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async () => {
      if (!resumeFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("resume", resumeFile);
      const res = await fetch("/api/cards/resume", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Failed to process resume");
      return res.json();
    },
    onSuccess: (data: CardJob) => {
      setResumeCardId(data.id);
      qc.invalidateQueries({ queryKey: ["/api/cards"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addExperience = () =>
    setManualExperience([...manualExperience, { dateRange: "", company: "", title: "", isSubRole: false }]);
  const removeExperience = (i: number) => setManualExperience(manualExperience.filter((_, idx) => idx !== i));
  const updateExperience = (i: number, field: keyof ExperienceEntry, value: any) => {
    const updated = [...manualExperience];
    (updated[i] as any)[field] = value;
    setManualExperience(updated);
  };

  const addEducation = () => setManualEducation([...manualEducation, { school: "", degree: "", honors: "" }]);
  const removeEducation = (i: number) => setManualEducation(manualEducation.filter((_, idx) => idx !== i));
  const updateEducation = (i: number, field: keyof EducationEntry, value: string) => {
    const updated = [...manualEducation];
    updated[i][field] = value;
    setManualEducation(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="card-preview-header">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
            <FileSliders className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Baseball Card Generator</h1>
            <p className="text-sm text-white/60">Candidate profile cards for executive search</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="resume">
            <TabsList className="w-full mb-6" data-testid="tabs">
              <TabsTrigger value="resume" className="flex-1" data-testid="tab-resume">
                <FileText className="w-4 h-4 mr-2" />
                Resume Upload
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1" data-testid="tab-manual">
                <User className="w-4 h-4 mr-2" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="flex-1" data-testid="tab-linkedin">
                <Linkedin className="w-4 h-4 mr-2" />
                LinkedIn URL
              </TabsTrigger>
            </TabsList>

            {/* Resume Upload Tab */}
            <TabsContent value="resume">
              <Card>
                <CardHeader>
                  <CardTitle>Upload a Resume</CardTitle>
                  <CardDescription>
                    Upload a candidate's PDF resume and the tool will extract their information automatically. You can review and edit before downloading.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Drop zone */}
                  <div
                    data-testid="resume-dropzone"
                    onDragOver={e => { e.preventDefault(); setResumeDragOver(true); }}
                    onDragLeave={() => setResumeDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setResumeDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type === "application/pdf") setResumeFile(file);
                      else toast({ title: "PDF only", description: "Please upload a PDF file", variant: "destructive" });
                    }}
                    className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                      resumeDragOver ? "border-[#142137] bg-blue-50" : "border-border hover:border-[#142137]/50"
                    }`}
                    onClick={() => document.getElementById("resume-file-input")?.click()}
                  >
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    {resumeFile ? (
                      <div>
                        <p className="font-semibold text-[#142137]">{resumeFile.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{(resumeFile.size / 1024).toFixed(0)} KB — click to change</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">Drop a PDF resume here</p>
                        <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                      </div>
                    )}
                    <input
                      id="resume-file-input"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={e => setResumeFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-800 font-medium">How it works</p>
                    <p className="text-xs text-blue-700 mt-1">
                      The tool reads the resume text and extracts the candidate's name, title, work history, and education. For best results, use a text-based PDF (not a scanned image). You can always switch to <strong>Manual Entry</strong> to fill in any missing details.
                    </p>
                  </div>

                  <Button
                    data-testid="button-generate-resume"
                    onClick={() => resumeMutation.mutate()}
                    disabled={!resumeFile || resumeMutation.isPending}
                    className="w-full bg-[#142137] hover:bg-[#1e3050] text-white"
                  >
                    {resumeMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Parsing resume…</>
                    ) : (
                      "Generate Baseball Card"
                    )}
                  </Button>

                  {resumeCardId && (
                    <CardStatusPoller
                      cardId={resumeCardId}
                      onDone={() => qc.invalidateQueries({ queryKey: ["/api/cards"] })}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* LinkedIn Tab */}
            <TabsContent value="linkedin">
              <Card>
                <CardHeader>
                  <CardTitle>Generate from LinkedIn</CardTitle>
                  <CardDescription>
                    Paste a public LinkedIn profile URL. The tool will extract the candidate's information and generate a formatted baseball card.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="linkedin-url">LinkedIn Profile URL</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input
                        id="linkedin-url"
                        data-testid="input-linkedin-url"
                        placeholder="https://www.linkedin.com/in/candidate-name"
                        value={linkedinUrl}
                        onChange={e => setLinkedinUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && linkedinUrl && linkedinMutation.mutate(linkedinUrl)}
                      />
                      <Button
                        data-testid="button-generate-linkedin"
                        onClick={() => linkedinMutation.mutate(linkedinUrl)}
                        disabled={!linkedinUrl || linkedinMutation.isPending}
                        className="bg-[#142137] hover:bg-[#1e3050] text-white shrink-0"
                      >
                        {linkedinMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Generate"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-xs text-amber-800 font-medium">Note on LinkedIn access</p>
                    <p className="text-xs text-amber-700 mt-1">
                      LinkedIn limits automated access. If generation fails, use the <strong>Manual Entry</strong> tab to enter the candidate's details directly.
                    </p>
                  </div>

                  {activeCardId && (
                    <CardStatusPoller
                      cardId={activeCardId}
                      onDone={() => qc.invalidateQueries({ queryKey: ["/api/cards"] })}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manual Entry Tab */}
            <TabsContent value="manual">
              <Card>
                <CardHeader>
                  <CardTitle>Manual Data Entry</CardTitle>
                  <CardDescription>
                    Enter candidate details directly. All fields map to the baseball card template.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Header Info */}
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Candidate Header</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>Full Name *</Label>
                        <Input data-testid="input-name" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Daniel Diez" className="mt-1" />
                      </div>
                      <div className="col-span-2">
                        <Label>Title / Role *</Label>
                        <Input data-testid="input-title" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="Chief Business Officer" className="mt-1" />
                      </div>
                      <div>
                        <Label>Company Name *</Label>
                        <Input data-testid="input-company" value={manualCompany} onChange={e => setManualCompany(e.target.value)} placeholder="Agility Robotics, Inc." className="mt-1" />
                      </div>
                      <div>
                        <Label>Candidate Location</Label>
                        <Input data-testid="input-location" value={manualLocation} onChange={e => setManualLocation(e.target.value)} placeholder="New York, New York" className="mt-1" />
                      </div>
                    </div>
                  </div>

                  <div className="section-divider" />

                  {/* Company Info */}
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Company (Left Column)</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>Company Location</Label>
                        <Input data-testid="input-company-location" value={manualCompanyLocation} onChange={e => setManualCompanyLocation(e.target.value)} placeholder="Salem, Oregon" className="mt-1" />
                      </div>
                      <div>
                        <Label>Company Type</Label>
                        <Input data-testid="input-company-type" value={manualCompanyType} onChange={e => setManualCompanyType(e.target.value)} placeholder="Sponsor-Backed" className="mt-1" />
                      </div>
                      <div>
                        <Label>Company Description</Label>
                        <Textarea
                          data-testid="input-company-desc"
                          value={manualCompanyDesc}
                          onChange={e => setManualCompanyDesc(e.target.value)}
                          placeholder="Agility Robotics, Inc. designs, manufactures, and provides humanoid robots…"
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="section-divider" />

                  {/* Experience */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Work Experience</h3>
                      <Button variant="outline" size="sm" onClick={addExperience} data-testid="button-add-experience">
                        <Plus className="w-3.5 h-3.5 mr-1" />Add Role
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {manualExperience.map((exp, i) => (
                        <div key={i} className="p-3 border rounded-lg space-y-2 relative" data-testid={`experience-row-${i}`}>
                          <button
                            onClick={() => removeExperience(i)}
                            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                            data-testid={`button-remove-experience-${i}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Date Range</Label>
                              <Input
                                data-testid={`input-exp-daterange-${i}`}
                                value={exp.dateRange}
                                onChange={e => updateExperience(i, "dateRange", e.target.value)}
                                placeholder="2024-Present"
                                className="mt-0.5 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Company</Label>
                              <Input
                                data-testid={`input-exp-company-${i}`}
                                value={exp.company}
                                onChange={e => updateExperience(i, "company", e.target.value)}
                                placeholder="Agility Robotics, Inc."
                                className="mt-0.5 h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Title / Role</Label>
                            <Input
                              data-testid={`input-exp-title-${i}`}
                              value={exp.title}
                              onChange={e => updateExperience(i, "title", e.target.value)}
                              placeholder="Chief Business Officer"
                              className="mt-0.5 h-8 text-sm"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!exp.isSubRole}
                              onChange={e => updateExperience(i, "isSubRole", e.target.checked)}
                              data-testid={`checkbox-subrole-${i}`}
                            />
                            Sub-role (same company, no company header)
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="section-divider" />

                  {/* Education */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Education / Certifications</h3>
                      <Button variant="outline" size="sm" onClick={addEducation} data-testid="button-add-education">
                        <Plus className="w-3.5 h-3.5 mr-1" />Add
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {manualEducation.map((edu, i) => (
                        <div key={i} className="p-3 border rounded-lg space-y-2 relative" data-testid={`education-row-${i}`}>
                          <button onClick={() => removeEducation(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" data-testid={`button-remove-education-${i}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <Label className="text-xs">School / Institution</Label>
                            <Input data-testid={`input-edu-school-${i}`} value={edu.school} onChange={e => updateEducation(i, "school", e.target.value)} placeholder="Baruch College" className="mt-0.5 h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Degree / Program</Label>
                            <Input data-testid={`input-edu-degree-${i}`} value={edu.degree} onChange={e => updateEducation(i, "degree", e.target.value)} placeholder="B.A. Psychology and Chemistry" className="mt-0.5 h-8 text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs">Honors (optional)</Label>
                            <Input data-testid={`input-edu-honors-${i}`} value={edu.honors || ""} onChange={e => updateEducation(i, "honors", e.target.value)} placeholder="With Honors" className="mt-0.5 h-8 text-sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="section-divider" />

                  {/* Photo & Logo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Headshot Photo</h3>
                      <Input
                        data-testid="input-photo"
                        type="file"
                        accept="image/*"
                        onChange={e => setManualPhoto(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Top-left photo box</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Company Logo</h3>
                      <Input
                        data-testid="input-logo"
                        type="file"
                        accept="image/*"
                        onChange={e => setManualLogo(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Top-right logo area</p>
                    </div>
                  </div>

                  <Button
                    data-testid="button-generate-manual"
                    onClick={() => manualMutation.mutate()}
                    disabled={!manualName || !manualTitle || manualMutation.isPending}
                    className="w-full bg-[#142137] hover:bg-[#1e3050] text-white"
                  >
                    {manualMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                    ) : (
                      "Generate Baseball Card"
                    )}
                  </Button>

                  {manualCardId && (
                    <CardStatusPoller
                      cardId={manualCardId}
                      onDone={() => qc.invalidateQueries({ queryKey: ["/api/cards"] })}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar: History */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generated Cards</CardTitle>
              <CardDescription className="text-xs">Recent history — click to download</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!allCards || allCards.length === 0 ? (
                <div className="px-4 pb-4 text-sm text-muted-foreground text-center py-8">
                  <FileSliders className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No cards generated yet
                </div>
              ) : (
                <div className="divide-y">
                  {[...allCards].reverse().map(card => (
                    <div key={card.id} className="px-4 py-3" data-testid={`card-history-${card.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{card.name || card.linkedinUrl}</p>
                          {card.title && <p className="text-xs text-muted-foreground truncate">{card.title}</p>}
                          {card.company && <p className="text-xs text-muted-foreground truncate">{card.company}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <StatusBadge status={card.status} />
                          {card.status === "done" && (
                            <a href={`/api/cards/${card.id}/download`} target="_blank" rel="noreferrer">
                              <Button variant="ghost" size="sm" className="h-7 px-2" data-testid={`button-download-${card.id}`}>
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Preview */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Card Format</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded border overflow-hidden text-[10px] leading-tight">
                <div className="card-preview-header p-2 text-white">
                  <p className="font-semibold">Candidate Name</p>
                  <p className="opacity-80">Title · Company · Location</p>
                </div>
                <div className="grid grid-cols-3 bg-white p-1.5 gap-1">
                  <div className="border-r pr-1">
                    <p className="font-semibold text-gray-700">Company</p>
                    <p className="text-gray-500 italic mt-0.5">Description…</p>
                  </div>
                  <div className="border-r px-1">
                    <p className="font-semibold text-gray-700">Experience</p>
                    <p className="text-gray-500 mt-0.5">2024 · Role</p>
                    <p className="text-gray-500">2021 · Role</p>
                  </div>
                  <div className="pl-1">
                    <p className="font-semibold text-gray-700">Education</p>
                    <p className="text-gray-500 mt-0.5">School</p>
                    <p className="text-gray-500">Degree</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Matches your master PPTX template exactly</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
