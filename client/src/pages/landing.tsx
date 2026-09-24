import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  HelpCircle, 
  Lightbulb, 
  HeartHandshake, 
  Upload, 
  X, 
  Check, 
  Copy, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  LogIn, 
  Layers, 
  LifeBuoy, 
  Image as ImageIcon 
} from "lucide-react";

interface PublicProject {
  id: string;
  name: string;
  companyName?: string;
  companyId?: string | null;
}

type TicketType = "complaint" | "enquiry" | "suggestion" | "compliment";

const TICKET_TYPES: { id: TicketType; label: string; description: string; icon: typeof AlertTriangle; color: string; activeBorder: string; activeBg: string }[] = [
  {
    id: "complaint",
    label: "Complaint",
    description: "Report an issue, defect, or service disruption",
    icon: AlertTriangle,
    color: "text-rose-600",
    activeBorder: "border-rose-500 ring-2 ring-rose-200",
    activeBg: "bg-rose-50/70",
  },
  {
    id: "enquiry",
    label: "Enquiry",
    description: "General questions, assistance, or account requests",
    icon: HelpCircle,
    color: "text-sky-600",
    activeBorder: "border-sky-500 ring-2 ring-sky-200",
    activeBg: "bg-sky-50/70",
  },
  {
    id: "suggestion",
    label: "Suggestion",
    description: "Feature ideas, recommendations, and improvements",
    icon: Lightbulb,
    color: "text-amber-600",
    activeBorder: "border-amber-500 ring-2 ring-amber-200",
    activeBg: "bg-amber-50/70",
  },
  {
    id: "compliment",
    label: "Compliment",
    description: "Share positive feedback and kudos with our team",
    icon: HeartHandshake,
    color: "text-emerald-600",
    activeBorder: "border-emerald-500 ring-2 ring-emerald-200",
    activeBg: "bg-emerald-50/70",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [projectId, setProjectId] = useState<string>("");
  const [type, setType] = useState<TicketType>("complaint");
  const [subject, setSubject] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [contactName, setContactName] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [screenshots, setScreenshots] = useState<{ name: string; size: number; base64: string }[]>([]);

  // Submission result state
  const [submittedTicket, setSubmittedTicket] = useState<{ ticketNumber: string; email: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Fetch active projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<PublicProject[]>({
    queryKey: ['/api/public/projects'],
    queryFn: async () => {
      const res = await fetch('/api/public/projects');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Handle image attachment
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - screenshots.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Attachment limit reached",
        description: "You can upload a maximum of 5 screenshots.",
        variant: "destructive",
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid file type",
          description: `"${file.name}" is not an image file.`,
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `"${file.name}" exceeds the 5MB size limit.`,
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setScreenshots((prev) => [
            ...prev,
            {
              name: file.name,
              size: file.size,
              base64: reader.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (indexToRemove: number) => {
    setScreenshots((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit ticket mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        projectId,
        type,
        subject: subject.trim(),
        description: description.trim(),
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim() || undefined,
        screenshots: screenshots.map((s) => s.base64),
      };

      const res = await fetch('/api/public/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Submission failed' }));
        throw new Error(err.message || 'Failed to submit ticket');
      }

      return res.json();
    },
    onSuccess: (data) => {
      setSubmittedTicket({
        ticketNumber: data.ticketNumber,
        email: contactEmail.trim(),
      });
      toast({
        title: "Ticket Submitted Successfully!",
        description: `Your ticket reference is ${data.ticketNumber}.`,
      });
      // Reset input form
      setProjectId("");
      setType("complaint");
      setSubject("");
      setDescription("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setScreenshots([]);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Error",
        description: error.message || "Failed to submit ticket. Please check your inputs.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toast({ title: "Required Field", description: "Please select your project/application.", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Required Field", description: "Please provide an issue title or summary.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Required Field", description: "Please describe the issue or enquiry.", variant: "destructive" });
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      toast({ title: "Invalid Email", description: "Please enter a valid contact email address.", variant: "destructive" });
      return;
    }

    submitMutation.mutate();
  };

  const copyTicketNumber = () => {
    if (submittedTicket?.ticketNumber) {
      navigator.clipboard.writeText(submittedTicket.ticketNumber);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({ title: "Copied to clipboard", description: submittedTicket.ticketNumber });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Ecorenet Logo" 
              className="h-9 sm:h-10 w-auto max-w-[220px] object-contain"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/login")}
              className="text-xs font-semibold text-slate-700 hover:text-primary border-slate-300 hover:border-primary/40 shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5 mr-1.5" />
              Staff Login
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-10 lg:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Heading */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              How can we assist you today?
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Submit your support request, incident, or enquiry directly to our engineering team.
            </p>
          </div>

          {/* If Ticket is Submitted: Show Confirmation View */}
          {submittedTicket ? (
            <Card className="border border-emerald-200 bg-white shadow-xl shadow-emerald-500/5 rounded-2xl overflow-hidden animate-in fade-in-50 duration-300">
              <div className="h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <CardContent className="p-8 sm:p-12 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                  Support Ticket Logged!
                </h2>
                <p className="text-slate-600 max-w-md mx-auto mb-8 text-sm sm:text-base">
                  Thank you. Your issue has been logged into our support queue and routed to the assigned project team. A confirmation has been sent to{" "}
                  <strong className="text-slate-800">{submittedTicket.email}</strong>.
                </p>

                {/* Ticket Number Display Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-md mx-auto mb-8">
                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Your Reference Ticket Number
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-2xl sm:text-3xl font-extrabold text-primary tracking-wider">
                      {submittedTicket.ticketNumber}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyTicketNumber}
                      className="border-slate-300 hover:bg-white text-slate-700 h-9"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 mr-1 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    onClick={() => setSubmittedTicket(null)}
                    className="bg-primary hover:bg-primary-dark text-white font-semibold px-8 shadow-sm"
                  >
                    Submit Another Request
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setLocation("/login")}
                    className="border-slate-300 text-slate-700 font-semibold"
                  >
                    Staff Portal Login
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Ticket Form Card */
            <Card className="border border-slate-200 bg-white shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
              <CardHeader className="p-6 sm:p-8 pb-4 border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Raise a Support Ticket
                </CardTitle>
                <CardDescription className="text-sm text-slate-500">
                  Please provide details about the issue or request. All fields marked with * are required.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 pt-6">
                <form onSubmit={handleSubmit} className="space-y-7">
                  
                  {/* Step 1: Select Ticket Type */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-900">
                      1. What type of request is this? <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {TICKET_TYPES.map((item) => {
                        const Icon = item.icon;
                        const isSelected = type === item.id;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => setType(item.id)}
                            className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                              isSelected
                                ? `${item.activeBorder} ${item.activeBg} shadow-sm`
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs ${item.color}`}>
                                <Icon className="w-4 h-4" />
                              </span>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-slate-900 mb-0.5">
                                {item.label}
                              </div>
                              <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {item.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Select Project */}
                  <div className="space-y-2">
                    <label htmlFor="project-select" className="block text-sm font-semibold text-slate-900">
                      2. Project / Application <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="project-select"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      required
                      className="w-full h-11 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-primary transition-colors shadow-2xs disabled:bg-slate-50"
                      disabled={projectsLoading}
                    >
                      <option value="">
                        {projectsLoading ? "Loading projects..." : "-- Select your project or application --"}
                      </option>
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name} {proj.companyName && proj.companyName !== proj.name ? `(${proj.companyName})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      Select the project currently under support that this ticket pertains to.
                    </p>
                  </div>

                  {/* Step 3: Issue Title & Description */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="ticket-subject" className="block text-sm font-semibold text-slate-900">
                        3. Issue Title / Summary <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        id="ticket-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g., Unable to generate monthly billing PDF report"
                        required
                        className="h-11 border-slate-300 focus-visible:ring-primary text-sm shadow-2xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="ticket-description" className="block text-sm font-semibold text-slate-900">
                        4. Detailed Description <span className="text-rose-500">*</span>
                      </label>
                      <Textarea
                        id="ticket-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what occurred, steps to reproduce, error codes or messages, and what you expected to see..."
                        rows={5}
                        required
                        className="border-slate-300 focus-visible:ring-primary text-sm resize-y leading-relaxed shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Step 4: Screenshot Uploads */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-slate-900">
                        5. Attach Screenshots <span className="text-xs font-normal text-slate-500">(Optional, max 5 images)</span>
                      </label>
                      {screenshots.length > 0 && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {screenshots.length}/5 attached
                        </Badge>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFilesSelected(e.target.files)}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    {/* Upload Drop Area */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-primary/60 hover:bg-slate-50/80 rounded-xl p-6 text-center cursor-pointer transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-primary/10 text-slate-600 group-hover:text-primary mx-auto flex items-center justify-center mb-2 transition-colors">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-medium text-slate-700">
                        Click or drag images here to attach screenshots
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Supports PNG, JPG, or WEBP (up to 5MB each)
                      </div>
                    </div>

                    {/* Previews */}
                    {screenshots.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
                        {screenshots.map((img, idx) => (
                          <div
                            key={idx}
                            className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center shadow-2xs"
                          >
                            <img
                              src={img.base64}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeScreenshot(idx)}
                              className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-90 hover:opacity-100 hover:scale-105 transition-all shadow-md"
                              title="Remove image"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white px-1.5 py-0.5 truncate text-center">
                              {img.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step 5: Submitter Contact Information */}
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <label className="block text-sm font-semibold text-slate-900">
                      6. Your Contact Details
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="contact-name" className="text-xs font-medium text-slate-700">
                          Full Name
                        </label>
                        <Input
                          id="contact-name"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="e.g., Alex Johnson"
                          className="h-10 border-slate-300 focus-visible:ring-primary text-sm shadow-2xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="contact-email" className="text-xs font-medium text-slate-700">
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="alex@company.com"
                          required
                          className="h-10 border-slate-300 focus-visible:ring-primary text-sm shadow-2xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="contact-phone" className="text-xs font-medium text-slate-700">
                          Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <Input
                          id="contact-phone"
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+254 700 000 000"
                          className="h-10 border-slate-300 focus-visible:ring-primary text-sm shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Action Button */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">
                      By submitting this ticket, you consent to our team contacting you regarding this request.
                    </p>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={submitMutation.isPending}
                      className="w-full sm:w-auto px-8 bg-primary hover:bg-primary-dark text-white font-semibold shadow-md shadow-primary/20 transition-all hover:scale-[1.01]"
                    >
                      {submitMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Submitting Ticket...
                        </>
                      ) : (
                        <>
                          Submit Support Ticket
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="Ecorenet Logo" 
              className="h-6 w-auto max-w-[150px] object-contain opacity-85"
            />
            <span>&copy; {new Date().getFullYear()} Ecorenet Business Solutions Limited. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/login" className="hover:text-primary transition-colors font-medium">
              Staff Portal
            </a>
            <span>•</span>
            <span className="text-slate-400">Support Operations Desk</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
