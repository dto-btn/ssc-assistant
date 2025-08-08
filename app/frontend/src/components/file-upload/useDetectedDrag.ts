import React, { useEffect, useRef, useState } from "react";

type UseDetectedDragProps = {
    onDrop?: (e: React.DragEvent) => void;
}

export const useDetectedDrag = (
    props: UseDetectedDragProps = {}
): boolean => {
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
                if (props.onDrop) {
                    // Create a synthetic React.DragEvent from the native event
                    const syntheticEvent = {
                        ...e,
                        nativeEvent: e,
                        currentTarget: window as unknown as EventTarget & Element,
                        target: e.target as EventTarget & Element,
                        isDefaultPrevented: () => e.defaultPrevented,
                        isPropagationStopped: () => false,
                        persist: () => {},
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation(),
                        bubbles: e.bubbles,
                        cancelable: e.cancelable,
                        // Add any other properties as needed
                    } as unknown as React.DragEvent;
                    props.onDrop(syntheticEvent);
                }
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
    }, [props]);

    return detectedDrag;
}