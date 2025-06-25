import { useEffect, useRef, useState } from "react";

export const useDetectedDrag = (): boolean => {
    const numDrags = useRef(0);
    const [detectedDrag, setDetectedDrag] = useState(false);

    const updateDragState = () => {
        setDetectedDrag(numDrags.current > 0);
    }

    const subtractDragCount = () => {
        numDrags.current = Math.max(0, numDrags.current - 1);
        updateDragState();
    }

    const addDragCount = () => {
        numDrags.current += 1;
        updateDragState();
    }


    useEffect(() => {
        const hasFiles = (e: DragEvent) => {
            if (!e.dataTransfer) return false;
            // Prefer items for modern browsers
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                return Array.from(e.dataTransfer.items).some(item => item.kind === 'file');
            }
            // Fallback for types
            if (e.dataTransfer.types) {
                return Array.from(e.dataTransfer.types).includes('Files');
            }
            return false;
        };
        const handleWindowDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasFiles(e)) {
                addDragCount();
            }
        };
        const handleWindowDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasFiles(e)) {
                subtractDragCount();
            }
        };
        const handleWindowDragOver = (e: DragEvent) => {
            // this function is just to prevent any strange behavior
            e.preventDefault();
            e.stopPropagation();
            if (hasFiles(e)) {
                updateDragState();
            }
        };
        const handleWindowDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasFiles(e)) {
                // If we just dropped files, we reset the drag count
                numDrags.current = 0;
                updateDragState();
            }
        };
        const handleWindowFocus = () => {
            // When the window is focused, we reset the drag count
            numDrags.current = 0;
            updateDragState();
        }

        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('drop', handleWindowDrop);
        window.addEventListener('dragenter', handleWindowDragEnter);
        window.addEventListener('dragleave', handleWindowDragLeave);
        window.addEventListener('dragover', handleWindowDragOver);
        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            window.removeEventListener('drop', handleWindowDrop);
            window.removeEventListener('dragenter', handleWindowDragEnter);
            window.removeEventListener('dragleave', handleWindowDragLeave);
            window.removeEventListener('dragover', handleWindowDragOver);

        };
    }, []);

    return detectedDrag;
}