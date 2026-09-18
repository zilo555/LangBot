import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, ExternalLink, LockKeyhole } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const VIEWPORT_GAP = 12;
const MIN_POPOVER_WIDTH = 220;
const MAX_POPOVER_WIDTH = 340;

type TargetRect = Pick<
  DOMRect,
  'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'
>;

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

export interface GuidedTourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  complete?: boolean;
  advanceOnComplete?: boolean;
  requirement?: string;
  action?: {
    href: string;
    label: string;
  };
}

interface GuidedTourProps {
  enabled?: boolean;
  storageKey: string;
  steps: GuidedTourStep[];
  testId?: string;
}

function readProgress(storageKey: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function storeProgress(storageKey: string, value: string) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // Keep the tour usable when browser storage is unavailable.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export default function GuidedTour({
  enabled = true,
  storageKey,
  steps,
  testId = 'guided-tour',
}: GuidedTourProps) {
  const { t } = useTranslation();
  const initialProgress = useMemo(() => readProgress(storageKey), [storageKey]);
  const [finished, setFinished] = useState(initialProgress === 'completed');
  const [activeStepId, setActiveStepId] = useState<string | null>(() =>
    initialProgress === 'completed' ? null : initialProgress,
  );
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPosition, setPopoverPosition] =
    useState<PopoverPosition | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const previousStorageKeyRef = useRef(storageKey);
  const previousCompletionRef = useRef<{
    stepId: string;
    complete: boolean;
  } | null>(null);

  const activeIndex = steps.findIndex((step) => step.id === activeStepId);
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : undefined;
  const isComplete = activeStep?.complete !== false;
  const isPopoverPositioned = popoverPosition !== null;

  useEffect(() => {
    if (previousStorageKeyRef.current === storageKey) return;
    previousStorageKeyRef.current = storageKey;
    const progress = readProgress(storageKey);
    setFinished(progress === 'completed');
    setActiveStepId(progress === 'completed' ? null : progress);
    setTargetRect(null);
    setPopoverPosition(null);
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || steps.length === 0 || finished) {
      setActiveStepId(null);
      return;
    }

    const currentIndex = steps.findIndex((step) => step.id === activeStepId);
    const firstIncompleteIndex = steps.findIndex(
      (step) => step.complete === false,
    );
    const nextIndex =
      currentIndex < 0
        ? 0
        : firstIncompleteIndex >= 0 && firstIncompleteIndex < currentIndex
          ? firstIncompleteIndex
          : currentIndex;

    if (nextIndex !== currentIndex) {
      const nextStep = steps[nextIndex];
      setActiveStepId(nextStep.id);
      storeProgress(storageKey, nextStep.id);
    }
  }, [activeStepId, enabled, finished, steps, storageKey]);

  const measure = useCallback(() => {
    if (!activeStep) return;
    const target = document.querySelector<HTMLElement>(activeStep.target);
    if (!target) {
      setTargetRect(null);
      setPopoverPosition(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const nextRect: TargetRect = {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
    setTargetRect(nextRect);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popoverHeight = popoverRef.current?.offsetHeight ?? 250;
    const rightSpace = viewportWidth - rect.right - VIEWPORT_GAP * 2;
    const leftSpace = rect.left - VIEWPORT_GAP * 2;
    let width = Math.min(MAX_POPOVER_WIDTH, viewportWidth - VIEWPORT_GAP * 2);
    let left = VIEWPORT_GAP;
    let top = rect.bottom + VIEWPORT_GAP;

    if (rightSpace >= MIN_POPOVER_WIDTH) {
      width = Math.min(MAX_POPOVER_WIDTH, rightSpace);
      left = rect.right + VIEWPORT_GAP;
      top = clamp(
        rect.top,
        VIEWPORT_GAP,
        viewportHeight - popoverHeight - VIEWPORT_GAP,
      );
    } else if (leftSpace >= MIN_POPOVER_WIDTH) {
      width = Math.min(MAX_POPOVER_WIDTH, leftSpace);
      left = rect.left - VIEWPORT_GAP - width;
      top = clamp(
        rect.top,
        VIEWPORT_GAP,
        viewportHeight - popoverHeight - VIEWPORT_GAP,
      );
    } else {
      top =
        rect.bottom + VIEWPORT_GAP + popoverHeight <= viewportHeight
          ? rect.bottom + VIEWPORT_GAP
          : rect.top - popoverHeight - VIEWPORT_GAP;
      top = clamp(
        top,
        VIEWPORT_GAP,
        viewportHeight - popoverHeight - VIEWPORT_GAP,
      );
    }

    setPopoverPosition({ left, top, width });
  }, [activeStep]);

  useEffect(() => {
    if (!enabled || !activeStep) return;
    const target = document.querySelector<HTMLElement>(activeStep.target);
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const frame = window.requestAnimationFrame(measure);
    const delayedMeasure = window.setTimeout(measure, 240);
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayedMeasure);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [activeStep, enabled, measure]);

  useEffect(() => {
    if (isPopoverPositioned) measure();
  }, [activeStep?.id, isPopoverPositioned, measure]);

  const handleNext = useCallback(() => {
    if (!activeStep || !isComplete) return;
    const nextStep = steps[activeIndex + 1];
    setTargetRect(null);
    setPopoverPosition(null);
    if (!nextStep) {
      storeProgress(storageKey, 'completed');
      setFinished(true);
      setActiveStepId(null);
      return;
    }
    storeProgress(storageKey, nextStep.id);
    setActiveStepId(nextStep.id);
  }, [activeIndex, activeStep, isComplete, steps, storageKey]);

  useEffect(() => {
    const handleNativeClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>(
        '[data-guided-tour-action="next"]',
      );
      if (
        !button ||
        button.dataset.guidedTourId !== testId ||
        button.disabled
      ) {
        return;
      }
      handleNext();
    };

    // Translation extensions can rewrite nodes inside the popover and detach
    // React's delegated handler. Capture the command by its stable data marker.
    document.addEventListener('click', handleNativeClick, true);
    return () => document.removeEventListener('click', handleNativeClick, true);
  }, [handleNext, testId]);

  useEffect(() => {
    if (!activeStep) return;
    const previous = previousCompletionRef.current;
    previousCompletionRef.current = {
      stepId: activeStep.id,
      complete: isComplete,
    };
    if (
      !activeStep.advanceOnComplete ||
      previous?.stepId !== activeStep.id ||
      previous.complete ||
      !isComplete
    ) {
      return;
    }

    window.setTimeout(handleNext, 0);
  }, [activeStep, handleNext, isComplete]);

  if (
    !enabled ||
    !activeStep ||
    !targetRect ||
    !popoverPosition ||
    typeof document === 'undefined'
  ) {
    return null;
  }

  const isLastStep = activeIndex === steps.length - 1;
  const titleId = `${testId}-${activeStep.id}-title`;

  return createPortal(
    <div
      data-testid={testId}
      data-active-step={activeStep.id}
      data-step-complete={String(isComplete)}
      translate="no"
      className="notranslate pointer-events-none"
    >
      <div
        aria-hidden="true"
        className="fixed z-[61] rounded-md ring-2 ring-blue-500 ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-200"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.32)',
        }}
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-labelledby={titleId}
        className="pointer-events-auto fixed z-[62] rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl"
        style={popoverPosition}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {t('guidedTour.label')}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('guidedTour.progress', {
              current: activeIndex + 1,
              total: steps.length,
            })}
          </span>
        </div>
        <h2 id={titleId} className="text-base font-semibold">
          {activeStep.title}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {activeStep.description}
        </p>
        {activeStep.action && (
          <a
            href={activeStep.action.href}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            {activeStep.action.label}
            <ExternalLink className="size-3.5" />
          </a>
        )}
        {!isComplete && activeStep.requirement && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
            <span>{activeStep.requirement}</span>
          </div>
        )}
        <Button
          type="button"
          data-guided-tour-action="next"
          data-guided-tour-id={testId}
          className="mt-4 w-full"
          disabled={!isComplete}
        >
          {isLastStep ? (
            <Check className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {isLastStep ? t('guidedTour.finish') : t('guidedTour.next')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
