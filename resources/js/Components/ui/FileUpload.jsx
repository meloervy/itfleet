import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RiUploadCloud2Line, RiFileTextLine, RiCloseLine } from 'react-icons/ri';

export function FileUpload({
    onChange,
    onImageSelect,
    accept = 'image/*,.pdf,.doc,.docx',
    maxFiles = 5,
    className,
}) {
    const [files, setFiles] = useState([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = useCallback(
        (newFiles) => {
            const validFiles = Array.from(newFiles).slice(0, maxFiles);
            setFiles((prev) => [...prev, ...validFiles]);

            if (onChange) {
                onChange(validFiles);
            }

            // If an image was dropped/uploaded, generate data URL for instant photo preview
            const imageFile = validFiles.find((f) => f.type.startsWith('image/'));
            if (imageFile && onImageSelect) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    onImageSelect(e.target.result, imageFile);
                };
                reader.readAsDataURL(imageFile);
            }
        },
        [maxFiles, onChange, onImageSelect],
    );

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files);
        }
    };

    const removeFile = (index, e) => {
        e.stopPropagation();
        setFiles((prev) => prev.filter((_, idx) => idx !== index));
    };

    return (
        <div className={cn('w-full', className)}>
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group/file relative block w-full cursor-pointer overflow-hidden rounded-sm border border-dashed p-5 transition-colors ${
                    isDragActive
                        ? 'border-[#026eff] bg-[#026eff]/5 dark:bg-[#026eff]/10'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-zinc-50/60 dark:bg-zinc-900/40'
                }`}
            >
                <input
                    ref={fileInputRef}
                    id="file-upload-input"
                    type="file"
                    accept={accept}
                    multiple={maxFiles > 1}
                    onChange={(e) => handleFileChange(e.target.files || [])}
                    className="hidden"
                />

                <div className="flex flex-col items-center justify-center text-center relative z-10">
                    <div className="w-9 h-9 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-2.5 text-zinc-500 dark:text-zinc-400 group-hover/file:text-[#026eff] transition-colors">
                        <RiUploadCloud2Line className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                        {isDragActive ? 'Drop file to upload' : 'Upload hardware photo or spec sheet'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                        Drag &amp; drop (.jpg, .png, .webp) or click to browse
                    </p>

                    <AnimatePresence>
                        {files.length > 0 && (
                            <div className="mt-3 w-full max-w-md space-y-1.5">
                                {files.map((file, idx) => (
                                    <motion.div
                                        key={file.name + idx}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.96 }}
                                        className="flex w-full items-center justify-between gap-3 rounded-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-left"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <RiFileTextLine className="w-4 h-4 text-[#026eff] shrink-0" />
                                            <p className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                                                {file.name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => removeFile(idx, e)}
                                                className="p-0.5 rounded-sm text-zinc-400 hover:text-rose-500 transition cursor-pointer"
                                            >
                                                <RiCloseLine className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default FileUpload;
