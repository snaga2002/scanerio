import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  FileText, 
  Link, 
  Sparkles, 
  RotateCcw, 
  ThumbsUp, 
  ThumbsDown,
  Download,
  Copy,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Scenario {
  id?: string;
  title?: string;
  as_a?: string;
  i_want?: string;
  so_that?: string;
  steps?: string[];
  expected_results?: string[];
  validations?: string[];
  acceptance_criteria?: string[];
}

interface ScenariosData {
  navigation_scenarios?: Scenario[];
  form_scenarios?: Scenario[];
  edge_cases?: Scenario[];
  user_stories?: Scenario[];
  gherkin?: string[];
  insufficient_context?: {
    reasons?: string[];
    missing_evidence?: string[];
  };
}

const TryIt = () => {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scenarios, setScenarios] = useState<ScenariosData | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('navigation');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
    dropZoneRef.current?.classList.remove('border-[#7e6ee3]', 'bg-[#7e6ee3]/5');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('border-[#7e6ee3]', 'bg-[#7e6ee3]/5');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-[#7e6ee3]', 'bg-[#7e6ee3]/5');
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const generateScenarios = async () => {
    if (!text.trim() && !url.trim() && files.length === 0) {
      toast.error('Please provide text, URL, or upload files');
      return;
    }

    setIsLoading(true);
    const newCorrelationId = `run-${Date.now()}`;
    setCorrelationId(newCorrelationId);

    try {
      const formData = new FormData();
      if (text.trim()) formData.append('text', text);
      if (url.trim()) formData.append('url', url);
      formData.append('correlation_id', newCorrelationId);
      files.forEach(file => formData.append('files', file));

      const response = await fetch('http://localhost:8000/generate-scenarios', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      setScenarios(data.scenarios);
      toast.success('Scenarios generated successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const sendFeedback = async (rating: number) => {
    const comment = prompt('Optional comment? (Cancel to skip)') || undefined;
    try {
      const response = await fetch('http://localhost:8000/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correlation_id: correlationId, rating, comment }),
      });

      if (!response.ok) throw new Error('Feedback failed');
      toast.success('Thanks for your feedback!');
    } catch (error) {
      toast.error('Feedback failed');
    }
  };

  const copyToClipboard = async () => {
    if (!scenarios) return;
    await navigator.clipboard.writeText(JSON.stringify(scenarios, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const downloadJSON = () => {
    if (!scenarios) return;
    const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenarios.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
  };

  const reset = () => {
    setText('');
    setUrl('');
    setFiles([]);
    setScenarios(null);
    setCorrelationId(null);
  };

  const renderScenarioList = (items?: Scenario[]) => {
    if (!items || items.length === 0) {
      return <p className="text-white/40 text-center py-8">No items generated.</p>;
    }

    return (
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <h4 className="font-semibold text-white mb-2">
              {item.id ? `${item.id}: ` : ''}{item.title || 'Untitled'}
            </h4>
            
            {item.as_a && (
              <p className="text-white/70 text-sm mb-3">
                <span className="text-[#7e6ee3]">As a</span> {item.as_a}, <span className="text-[#7e6ee3]">I want</span> {item.i_want}, <span className="text-[#7e6ee3]">so that</span> {item.so_that}.
              </p>
            )}

            {item.steps && item.steps.length > 0 && (
              <div className="mb-3">
                <h5 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Steps</h5>
                <ol className="list-decimal list-inside space-y-1">
                  {item.steps.map((step, i) => (
                    <li key={i} className="text-white/70 text-sm">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {item.expected_results && item.expected_results.length > 0 && (
              <div className="mb-3">
                <h5 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Expected Results</h5>
                <ul className="list-disc list-inside space-y-1">
                  {item.expected_results.map((result, i) => (
                    <li key={i} className="text-white/70 text-sm">{result}</li>
                  ))}
                </ul>
              </div>
            )}

            {item.validations && item.validations.length > 0 && (
              <div className="mb-3">
                <h5 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Validations</h5>
                <ul className="list-disc list-inside space-y-1">
                  {item.validations.map((v, i) => (
                    <li key={i} className="text-white/70 text-sm">{v}</li>
                  ))}
                </ul>
              </div>
            )}

            {item.acceptance_criteria && item.acceptance_criteria.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Acceptance Criteria</h5>
                <ul className="list-disc list-inside space-y-1">
                  {item.acceptance_criteria.map((ac, i) => (
                    <li key={i} className="text-white/70 text-sm">{ac}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderGherkin = () => {
    if (!scenarios?.gherkin || scenarios.gherkin.length === 0) {
      return <p className="text-white/40 text-center py-8">No Gherkin scenarios generated.</p>;
    }

    return (
      <pre className="bg-[#0b0f14] rounded-xl p-4 border border-white/10 overflow-x-auto">
        <code className="text-sm text-white/80 whitespace-pre-wrap">
          {scenarios.gherkin.join('\n\n')}
        </code>
      </pre>
    );
  };

  const renderRawJSON = () => {
    if (!scenarios) return null;

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyToClipboard}
            className="border-white/20 text-white hover:bg-white/10"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadJSON}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Download JSON
          </Button>
        </div>
        <pre className="bg-[#0b0f14] rounded-xl p-4 border border-white/10 overflow-x-auto max-h-96">
          <code className="text-sm text-white/80">
            {JSON.stringify(scenarios, null, 2)}
          </code>
        </pre>
      </div>
    );
  };

  return (
    <section id="try-it" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Try It <span className="text-gradient">Now</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Upload your Figma designs or describe your feature. Our AI will generate comprehensive test scenarios in seconds.
          </p>
        </div>

        {/* Input Panel */}
        <div className="bg-[#181818] rounded-2xl border border-white/10 overflow-hidden mb-8">
          <div className="p-6 space-y-6">
            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Describe your feature or flow
              </label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the user flow, forms, roles, constraints..."
                className="bg-[#0b0f14] border-white/10 text-white placeholder:text-white/30 min-h-[120px] resize-none"
              />
            </div>

            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                <Link className="w-4 h-4 inline mr-2" />
                Figma URL (optional)
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.figma.com/file/XXXX/Project..."
                className="bg-[#0b0f14] border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                <Upload className="w-4 h-4 inline mr-2" />
                Upload files (optional)
              </label>
              <div
                ref={dropZoneRef}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer transition-all hover:border-white/40 hover:bg-white/5"
              >
                <Upload className="w-8 h-8 text-white/40 mx-auto mb-3" />
                <p className="text-white/60 text-sm">
                  Drop files here or click to browse
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Supports: .txt, .json, .csv, .html, .md, .pdf, .png, .jpg, .docx
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.json,.csv,.html,.htm,.md,.pdf,.png,.jpg,.jpeg,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full text-sm"
                    >
                      <span className="text-white/70 truncate max-w-[200px]">{file.name}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-white/40 hover:text-white/80"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={generateScenarios}
                disabled={isLoading || (!text.trim() && !url.trim() && files.length === 0)}
                className="bg-[#7e6ee3] hover:bg-[#6b5dd3] text-white px-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Scenarios
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={reset}
                disabled={isLoading}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Results Panel */}
        {scenarios && (
          <div className="bg-[#181818] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6">
              {/* Results Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h3 className="text-xl font-semibold text-white">Generated Scenarios</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendFeedback(1)}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Helpful
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendFeedback(-1)}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Not Helpful
                  </Button>
                </div>
              </div>

              {/* Insufficient Context Warning */}
              {scenarios.insufficient_context && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-500 mb-1">Insufficient Context</h4>
                      {scenarios.insufficient_context.reasons && (
                        <div className="mb-2">
                          <p className="text-sm text-white/60">Reasons:</p>
                          <ul className="list-disc list-inside text-sm text-white/60">
                            {scenarios.insufficient_context.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {scenarios.insufficient_context.missing_evidence && (
                        <div>
                          <p className="text-sm text-white/60">Missing evidence:</p>
                          <ul className="list-disc list-inside text-sm text-white/60">
                            {scenarios.insufficient_context.missing_evidence.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-white/5 border border-white/10 mb-6 flex flex-wrap h-auto p-1 gap-1">
                  <TabsTrigger 
                    value="navigation" 
                    className="data-[state=active]:bg-[#7e6ee3] data-[state=active]:text-white text-white/70 px-3 py-2 text-sm"
                  >
                    Navigation ({scenarios.navigation_scenarios?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="forms" 
                    className="data-[state=active]:bg-[#7e6ee3] data-[state=active]:text-white text-white/70 px-3 py-2 text-sm"
                  >
                    Forms ({scenarios.form_scenarios?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="edge" 
                    className="data-[state=active]:bg-[#7e6ee3] data-[state=active]:text-white text-white/70 px-3 py-2 text-sm"
                  >
                    Edge Cases ({scenarios.edge_cases?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="stories" 
                    className="data-[state=active]:bg-[#7e6ee3] data-[state=active]:text-white text-white/70 px-3 py-2 text-sm"
                  >
                    User Stories ({scenarios.user_stories?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger 
                    value="gherkin" 
                    className="data-[state=active]:bg-[#7e6ee3] data-[state=active]:text-white text-white/70 px-3 py-2 text-sm"
                  >
                    Gherkin
                  </TabsTrigger>
                  <TabsTrigger 
                    value="raw" 
                    className="data-[state=active]:bg-[#7e6ee3] data-[state=active]:text-white text-white/70 px-3 py-2 text-sm"
                  >
                    Raw JSON
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="navigation" className="mt-0 outline-none">
                  {renderScenarioList(scenarios.navigation_scenarios)}
                </TabsContent>
                <TabsContent value="forms" className="mt-0 outline-none">
                  {renderScenarioList(scenarios.form_scenarios)}
                </TabsContent>
                <TabsContent value="edge" className="mt-0 outline-none">
                  {renderScenarioList(scenarios.edge_cases)}
                </TabsContent>
                <TabsContent value="stories" className="mt-0 outline-none">
                  {renderScenarioList(scenarios.user_stories)}
                </TabsContent>
                <TabsContent value="gherkin" className="mt-0 outline-none">
                  {renderGherkin()}
                </TabsContent>
                <TabsContent value="raw" className="mt-0 outline-none">
                  {renderRawJSON()}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default TryIt;
