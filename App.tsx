import React, { useState, useCallback, useRef, useEffect } from 'react';
import { editImageWithPrompt, analyzeImageWithPrompt } from './services/geminiService';

// --- Types & Interfaces ---
type Mode = 'edit' | 'analyze';

interface ImageFile {
    url: string;
    file: File;
}

interface EditedImageResult {
    originalUrl: string;
    editedUrl: string | null;
    error?: string;
}

// --- Helper Functions ---
const fileListToBase64 = (files: FileList): Promise<ImageFile[]> => {
    const promises = Array.from(files).map(file => {
        return new Promise<ImageFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ url: reader.result as string, file });
            reader.onerror = reject;
        });
    });
    return Promise.all(promises);
};

// --- SVG Icons ---
const IconUpload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
);
const IconSparkles = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m1-12a9 9 0 011.586 5.828l-2.086 2.086a2 2 0 000 2.828l2.086 2.086A9 9 0 016 21m12-9a9 9 0 00-1.586-5.828l2.086-2.086a2 2 0 012.828 0l-2.086 2.086A9 9 0 0018 12m-6-9v.01M12 21v-3" />
    </svg>
);
const IconDownload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);
const IconError = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

// --- Child Components ---

interface ControlPanelProps {
    mode: Mode;
    setMode: (mode: Mode) => void;
    onImagesSelect: (imageFiles: ImageFile[]) => void;
    onRemoveImage: (index: number) => void;
    onClearImages: () => void;
    prompt: string;
    setPrompt: (prompt: string) => void;
    onGenerate: () => void;
    isLoading: boolean;
    originalImages: ImageFile[];
}

const ControlPanel: React.FC<ControlPanelProps> = ({ mode, setMode, onImagesSelect, onRemoveImage, onClearImages, prompt, setPrompt, onGenerate, isLoading, originalImages }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const samplePrompts = {
        edit: ["Remove the background", "Make the background white", "Add a subtle shadow", "Improve the lighting"],
        analyze: ["Describe this image in detail", "What is the main subject?", "Identify all objects in this photo", "Is this photo good for a product listing?"]
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const imageFiles = await fileListToBase64(files);
            onImagesSelect(imageFiles);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Allow re-selecting same files
        }
    };

    const triggerFileSelect = () => fileInputRef.current?.click();
    const isSingleImageMode = mode === 'analyze';

    return (
        <div className="flex flex-col space-y-4 p-4 md:p-6 bg-gray-800/50 rounded-2xl h-full">
            <div className="flex bg-gray-900 p-1 rounded-full">
                <button onClick={() => setMode('edit')} className={`w-1/2 py-2 text-sm font-bold rounded-full transition-colors ${mode === 'edit' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>Image Editor</button>
                <button onClick={() => setMode('analyze')} className={`w-1/2 py-2 text-sm font-bold rounded-full transition-colors ${mode === 'analyze' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>Image Analyzer</button>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" multiple={!isSingleImageMode} />
            
            <div className="flex-grow flex flex-col space-y-4">
                <label className="text-lg font-semibold text-white">1. Upload {isSingleImageMode ? "Photo" : "Photos"}</label>
                {originalImages.length === 0 ? (
                     <button onClick={triggerFileSelect} className="relative aspect-video w-full border-2 border-dashed border-gray-600 rounded-lg flex flex-col justify-center items-center text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-colors duration-300">
                        <IconUpload />
                        <span className="mt-2 text-sm font-medium">Click to upload {isSingleImageMode ? "a photo" : "photos"}</span>
                        {!isSingleImageMode && <span className="text-xs text-gray-500">Batch processing available</span>}
                    </button>
                ) : (
                    <div className="space-y-3">
                        <div className={`grid gap-3 max-h-48 overflow-y-auto pr-2 ${isSingleImageMode ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'}`}>
                            {originalImages.map((image, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={image.url} alt={`preview ${index}`} className="w-full h-full object-cover rounded-md" />
                                    <button onClick={() => onRemoveImage(index)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image">&times;</button>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                           <p className="text-sm text-gray-300">{originalImages.length} image{originalImages.length > 1 ? 's' : ''} selected.</p>
                           <div className="flex gap-2">
                            {!isSingleImageMode && <button onClick={triggerFileSelect} className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-200 rounded-full hover:bg-indigo-600 transition-colors">Add more</button>}
                            <button onClick={onClearImages} className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-200 rounded-full hover:bg-red-600 transition-colors">Clear</button>
                           </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col space-y-4">
                <label htmlFor="prompt" className="text-lg font-semibold text-white">2. {mode === 'edit' ? "Describe your edit" : "Ask about the image"}</label>
                <textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === 'edit' ? "e.g. Remove the background..." : "e.g. Describe this scene..."}
                    className="w-full h-24 p-3 bg-gray-900 border border-gray-700 rounded-md text-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    disabled={originalImages.length === 0}
                />
                 <div>
                    <p className="text-sm text-gray-400 mb-2">Or try an example:</p>
                    <div className="flex flex-wrap gap-2">
                        {samplePrompts[mode].map((p) => (
                            <button key={p} onClick={() => setPrompt(p)} disabled={originalImages.length === 0} className="px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-200 rounded-full hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors">{p}</button>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={onGenerate} disabled={isLoading || !prompt || originalImages.length === 0} className="w-full mt-auto flex justify-center items-center gap-2 py-3 px-4 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform active:scale-95">
                {isLoading ? (
                    <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> {mode === 'edit' ? 'Generating...' : 'Analyzing...'}</>
                ) : (
                    <><IconSparkles />{mode === 'edit' ? 'Generate' : 'Analyze'}</>
                )}
            </button>
        </div>
    );
};

interface ImageResultProps {
    mode: Mode;
    originalImages: ImageFile[];
    editedImages: EditedImageResult[];
    analysisResult: string | null;
    isLoading: boolean;
    progress: { current: number; total: number; } | null;
}

const ImageResult: React.FC<ImageResultProps> = ({ mode, originalImages, editedImages, analysisResult, isLoading, progress }) => {
    const downloadImage = (url: string, originalFilename: string) => {
        const link = document.createElement('a');
        link.href = url;
        try {
            const nameParts = originalFilename.split('.');
            if (nameParts.length > 1) {
                nameParts.pop(); // remove extension
            }
            const name = nameParts.join('.') || 'image';
            link.download = `${name}-edited.jpg`;
        } catch (e) {
            link.download = 'edited-image.jpg';
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const EditResultCard = ({ item, index }: { item: EditedImageResult, index: number }) => (
         <div className="relative group aspect-square bg-gray-900 rounded-lg overflow-hidden shadow-md">
            {item.editedUrl ? (
                <>
                    <img src={item.editedUrl} alt="Edited result" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadImage(item.editedUrl!, originalImages[index]?.file.name || 'image')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"><IconDownload />Download</button>
                    </div>
                </>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2">
                    <IconError /><p className="mt-2 text-xs text-red-400 font-semibold">Generation Failed</p><p className="text-[10px] text-gray-400 leading-tight mt-1">{item.error}</p>
                </div>
            )}
        </div>
    );

    const EditModeSkeleton = () => (
        <div className="w-full h-full animate-pulse">
            <div className="h-6 w-1/3 bg-gray-700 rounded-md mb-4"></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(progress?.total ?? 4)].map((_, i) => <div key={i} className="aspect-square bg-gray-700 rounded-lg"></div>)}
            </div>
        </div>
    );

    const hasEditResults = editedImages.length > 0;
    const hasAnalysisResult = analysisResult || (mode === 'analyze' && originalImages.length > 0 && !isLoading);
    const hasAnyContent = hasEditResults || hasAnalysisResult;

    if (isLoading) {
        if (mode === 'edit') {
            return (
                <div className="w-full h-full bg-gray-800/50 rounded-2xl flex justify-center items-center p-4 md:p-6 overflow-hidden">
                    <EditModeSkeleton />
                </div>
            );
        }
        if (mode === 'analyze' && originalImages.length > 0) {
             return (
                <div className="w-full h-full bg-gray-800/50 rounded-2xl p-4 md:p-6 overflow-hidden">
                    <div className="w-full h-full flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/2 aspect-square flex-shrink-0">
                            <img src={originalImages[0].url} alt="Image being analyzed" className="w-full h-full object-contain rounded-lg bg-gray-900 opacity-50" />
                        </div>
                        <div className="w-full md:w-1/2">
                            <h3 className="text-lg font-semibold text-white mb-2">Analysis Result</h3>
                            <div className="bg-gray-900 p-4 rounded-lg text-gray-400 h-full flex flex-col justify-center items-center">
                                <svg className="animate-spin h-8 w-8 text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="font-semibold text-lg text-gray-300">Analyzing your image...</p>
                                <p className="text-sm text-gray-500 mt-1">Gemini is looking at the details.</p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="relative w-full h-full bg-gray-800/50 rounded-2xl flex justify-center items-center p-4 md:p-6 overflow-hidden">
            {!hasAnyContent && (
                <div className="text-center text-gray-500">
                    <IconSparkles />
                    <h3 className="mt-4 text-lg font-medium text-gray-300">Your results will appear here</h3>
                    <p className="mt-1 text-sm">{mode === 'edit' ? "Upload images and describe the changes." : "Upload an image and ask a question."}</p>
                </div>
            )}

            {mode === 'edit' && hasEditResults && (
                <div className="w-full h-full">
                    <h3 className="text-lg font-semibold text-white mb-4">Results {progress && `(${progress.current}/${progress.total})`}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto h-[calc(100%-2rem)] pr-2">
                        {editedImages.map((item, index) => <EditResultCard key={index} item={item} index={index} />)}
                    </div>
                </div>
            )}

            {mode === 'analyze' && hasAnalysisResult && (
                <div className="w-full h-full flex flex-col md:flex-row gap-6 overflow-y-auto">
                    <div className="w-full md:w-1/2 aspect-square flex-shrink-0">
                        <img src={originalImages[0].url} alt="Image for analysis" className="w-full h-full object-contain rounded-lg bg-gray-900" />
                    </div>
                    <div className="w-full md:w-1/2">
                        <h3 className="text-lg font-semibold text-white mb-2">Analysis Result</h3>
                        <div className="bg-gray-900 p-4 rounded-lg text-gray-300 whitespace-pre-wrap text-sm h-full overflow-y-auto">{analysisResult || 'Analysis will appear here.'}</div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Main App Component ---
const LOCAL_STORAGE_KEY = 'ai-photo-editor-last-session';

export default function App() {
    const [mode, setMode] = useState<Mode>('edit');
    const [originalImages, setOriginalImages] = useState<ImageFile[]>([]);
    const [editedImages, setEditedImages] = useState<EditedImageResult[]>([]);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);

    // Load previous session on component mount for edit mode only
    useEffect(() => {
        try {
            const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedData) {
                const parsedImages: EditedImageResult[] = JSON.parse(savedData);
                if (Array.isArray(parsedImages)) {
                    setMode('edit');
                    setEditedImages(parsedImages);
                }
            }
        } catch (err) {
            console.error("Failed to load saved images:", err);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }, []);

    const handleModeChange = (newMode: Mode) => {
        setMode(newMode);
        setOriginalImages([]);
        setEditedImages([]);
        setAnalysisResult(null);
        setPrompt('');
        setError(null);
        setProgress(null);
        if (newMode === 'analyze') {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }

    const handleImagesSelect = useCallback((newFiles: ImageFile[]) => {
        if (mode === 'analyze') {
            setOriginalImages(newFiles.slice(0, 1)); // Only take the first file
        } else {
            setOriginalImages(prev => [...prev, ...newFiles]);
        }
        setEditedImages([]);
        setAnalysisResult(null);
        setError(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }, [mode]);
    
    const handleRemoveImage = useCallback((indexToRemove: number) => {
        setOriginalImages(prev => prev.filter((_, index) => index !== indexToRemove));
        setEditedImages([]);
        setAnalysisResult(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }, []);

    const handleClearImages = useCallback(() => {
        setOriginalImages([]);
        setEditedImages([]);
        setAnalysisResult(null);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
    }, []);

    const handleGenerate = useCallback(async () => {
        if (originalImages.length === 0 || !prompt) {
            setError('Please upload an image and provide a prompt.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setEditedImages([]);
        setAnalysisResult(null);
        setProgress({ current: 0, total: originalImages.length });

        if (mode === 'edit') {
            const results: EditedImageResult[] = [];
            for (let i = 0; i < originalImages.length; i++) {
                const image = originalImages[i];
                try {
                    const base64Data = image.url.split(',')[1];
                    const mimeType = image.file.type;
                    const generatedBase64 = await editImageWithPrompt(base64Data, mimeType, prompt);
                    results.push({ originalUrl: image.url, editedUrl: `data:${mimeType};base64,${generatedBase64}` });
                } catch (err) {
                    console.error(`Failed to process image ${i + 1}:`, err);
                    results.push({ originalUrl: image.url, editedUrl: null, error: err instanceof Error ? err.message : 'An unknown error occurred.' });
                } finally {
                    setProgress({ current: i + 1, total: originalImages.length });
                    setEditedImages([...results]);
                }
            }
            try {
                if (results.length > 0) localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(results));
            } catch(err) {
                console.error("Failed to save results to localStorage.", err);
            }
        } else { // mode === 'analyze'
            try {
                const image = originalImages[0];
                const base64Data = image.url.split(',')[1];
                const mimeType = image.file.type;
                const textResult = await analyzeImageWithPrompt(base64Data, mimeType, prompt);
                setAnalysisResult(textResult);
            } catch(err) {
                setError(err instanceof Error ? err.message : "An unknown error occurred during analysis.");
            }
        }
        
        setIsLoading(false);
    }, [originalImages, prompt, mode]);

    return (
        <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col">
            <header className="py-4 px-8 text-center border-b border-gray-700">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                    Photo Editor & Analyzer
                </h1>
                <p className="text-gray-400 mt-1">Edit photos or ask questions about them using simple text instructions.</p>
            </header>

            <main className="flex-grow p-4 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto w-full min-h-[75vh]">
                <ControlPanel 
                    mode={mode}
                    setMode={handleModeChange}
                    onImagesSelect={handleImagesSelect}
                    onRemoveImage={handleRemoveImage}
                    onClearImages={handleClearImages}
                    originalImages={originalImages}
                    prompt={prompt}
                    setPrompt={setPrompt}
                    onGenerate={handleGenerate}
                    isLoading={isLoading}
                />
                <ImageResult 
                    mode={mode}
                    originalImages={originalImages}
                    editedImages={editedImages}
                    analysisResult={analysisResult}
                    isLoading={isLoading}
                    progress={progress}
                />
            </main>

            {error && (
                <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 animate-pulse">
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="absolute top-1 right-2 text-lg">&times;</button>
                </div>
            )}
        </div>
    );
}