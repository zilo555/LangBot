import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

const SIDEBAR_GUIDE_STORAGE_KEY = 'langbot_sidebar_guide_v1';
const MIN_POPOVER_WIDTH = 196;
const MAX_POPOVER_WIDTH = 320;
const VIEWPORT_GAP = 12;

const GUIDE_STEP_IDS = [
  'monitoring',
  'bots',
  'pipelines',
  'knowledge',
  'plugins',
  'add-extension',
  'models',
  'api-integration',
] as const;

type GuideStepId = (typeof GUIDE_STEP_IDS)[number];

type TargetRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

function loadStoredStep(): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(SIDEBAR_GUIDE_STORAGE_KEY);
    if (stored === 'completed') return null;

    const parsed = Number.parseInt(stored ?? '0', 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, GUIDE_STEP_IDS.length - 1);
  } catch {
    return 0;
  }
}

function storeGuideProgress(value: string) {
  try {
    localStorage.setItem(SIDEBAR_GUIDE_STORAGE_KEY, value);
  } catch {
    // The guide remains usable when browser storage is unavailable.
  }
}

function getTarget(stepId: GuideStepId): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(
    `[data-sidebar-guide="${stepId}"]`,
  );
}

function findAvailableStep(startIndex: number): number | null {
  for (let index = startIndex; index < GUIDE_STEP_IDS.length; index += 1) {
    const target = getTarget(GUIDE_STEP_IDS[index]);
    if (target) return index;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function SidebarGuide() {
  const { t } = useTranslation();
  const { isMobile, open, openMobile, setOpen, setOpenMobile } = useSidebar();
  const [stepIndex, setStepIndex] = useState<number | null>(loadStoredStep);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPosition, setPopoverPosition] =
    useState<PopoverPosition | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const originalSidebarStateRef = useRef<{
    open: boolean;
    openMobile: boolean;
  } | null>(null);

  const activeStepId =
    stepIndex === null ? null : (GUIDE_STEP_IDS[stepIndex] ?? null);

  const visibleStepCount = GUIDE_STEP_IDS.filter((stepId) =>
    getTarget(stepId),
  ).length;

  const visibleStepNumber = activeStepId
    ? GUIDE_STEP_IDS.slice(0, stepIndex ?? 0).filter((stepId) =>
        getTarget(stepId),
      ).length + 1
    : 0;
  const isPopoverReady = popoverPosition !== null;

  const restoreSidebarState = useCallback(() => {
    const original = originalSidebarStateRef.current;
    if (!original) return;
    if (isMobile) {
      setOpenMobile(original.openMobile);
    } else {
      setOpen(original.open);
    }
    originalSidebarStateRef.current = null;
  }, [isMobile, setOpen, setOpenMobile]);

  const completeGuide = useCallback(() => {
    storeGuideProgress('completed');
    setStepIndex(null);
    setTargetRect(null);
    setPopoverPosition(null);
    restoreSidebarState();
  }, [restoreSidebarState]);

  const measure = useCallback(() => {
    if (!activeStepId) return;
    const target = getTarget(activeStepId);
    if (!target) return;

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
    const popoverHeight = popoverRef.current?.offsetHeight ?? 210;
    const rightSpace = viewportWidth - nextRect.right - VIEWPORT_GAP * 2;
    const leftSpace = nextRect.left - VIEWPORT_GAP * 2;

    let width = Math.min(MAX_POPOVER_WIDTH, viewportWidth - VIEWPORT_GAP * 2);
    let left = VIEWPORT_GAP;
    let top = nextRect.bottom + VIEWPORT_GAP;

    if (rightSpace >= MIN_POPOVER_WIDTH) {
      width = Math.min(MAX_POPOVER_WIDTH, rightSpace);
      left = nextRect.right + VIEWPORT_GAP;
      top = clamp(
        nextRect.top,
        VIEWPORT_GAP,
        viewportHeight - popoverHeight - VIEWPORT_GAP,
      );
    } else if (leftSpace >= MIN_POPOVER_WIDTH) {
      width = Math.min(MAX_POPOVER_WIDTH, leftSpace);
      left = nextRect.left - VIEWPORT_GAP - width;
      top = clamp(
        nextRect.top,
        VIEWPORT_GAP,
        viewportHeight - popoverHeight - VIEWPORT_GAP,
      );
    } else {
      top =
        nextRect.bottom + VIEWPORT_GAP + popoverHeight <= viewportHeight
          ? nextRect.bottom + VIEWPORT_GAP
          : nextRect.top - popoverHeight - VIEWPORT_GAP;
      top = clamp(
        top,
        VIEWPORT_GAP,
        viewportHeight - popoverHeight - VIEWPORT_GAP,
      );
    }

    setPopoverPosition({ left, top, width });
  }, [activeStepId]);

  useEffect(() => {
    if (stepIndex === null) return;

    if (!originalSidebarStateRef.current) {
      originalSidebarStateRef.current = { open, openMobile };
    }

    if (isMobile) {
      setOpenMobile(true);
    } else {
      setOpen(true);
    }
  }, [isMobile, open, openMobile, setOpen, setOpenMobile, stepIndex]);

  useEffect(() => {
    if (stepIndex === null) return;

    const frame = window.requestAnimationFrame(() => {
      const availableIndex = findAvailableStep(stepIndex);
      if (availableIndex === null) {
        completeGuide();
        return;
      }
      if (availableIndex !== stepIndex) {
        storeGuideProgress(String(availableIndex));
        setStepIndex(availableIndex);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [completeGuide, stepIndex]);

  useEffect(() => {
    if (!activeStepId) return;
    const target = getTarget(activeStepId);
    if (!target) return;

    target.scrollIntoView({ block: 'nearest' });

    const delayedMeasure = window.setTimeout(measure, 260);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(target);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      window.clearTimeout(delayedMeasure);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [activeStepId, measure]);

  useEffect(() => {
    if (!isPopoverReady) return;
    measure();
    confirmButtonRef.current?.focus();
  }, [activeStepId, isPopoverReady, measure]);

  useEffect(() => {
    if (stepIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const blockKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        confirmButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', blockKeyboardNavigation, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', blockKeyboardNavigation, true);
    };
  }, [stepIndex]);

  function handleConfirm() {
    if (stepIndex === null) return;
    const nextIndex = findAvailableStep(stepIndex + 1);
    if (nextIndex === null) {
      completeGuide();
      return;
    }

    storeGuideProgress(String(nextIndex));
    setTargetRect(null);
    setPopoverPosition(null);
    setStepIndex(nextIndex);
  }

  if (
    !activeStepId ||
    !targetRect ||
    !popoverPosition ||
    typeof document === 'undefined'
  ) {
    return null;
  }

  const isLastVisibleStep =
    findAvailableStep((stepIndex ?? GUIDE_STEP_IDS.length - 1) + 1) === null;
  const titleId = `sidebar-guide-${activeStepId}-title`;

  return createPortal(
    <div data-testid="sidebar-guide">
      <div
        className="fixed inset-0 z-[90] cursor-default"
        aria-hidden="true"
        onClick={(event) => event.preventDefault()}
      />
      <div
        className="pointer-events-none fixed z-[91] rounded-md ring-2 ring-blue-500 ring-offset-2 ring-offset-background transition-[top,left,width,height] duration-200"
        aria-hidden="true"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          boxShadow: '0 0 0 9999px rgb(15 23 42 / 0.56)',
        }}
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed z-[92] rounded-lg border bg-popover p-4 text-popover-foreground shadow-xl"
        style={popoverPosition}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {t('sidebarGuide.label')}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t('sidebarGuide.progress', {
              current: visibleStepNumber,
              total: visibleStepCount,
            })}
          </span>
        </div>
        <h2 id={titleId} className="text-base font-semibold">
          {t(`sidebarGuide.steps.${activeStepId}.title`)}
        </h2>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {t(`sidebarGuide.steps.${activeStepId}.description`)}
        </p>
        <Button
          ref={confirmButtonRef}
          type="button"
          className="mt-4 w-full"
          onClick={handleConfirm}
        >
          {isLastVisibleStep ? (
            <Check className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          {isLastVisibleStep
            ? t('sidebarGuide.finish')
            : t('sidebarGuide.confirm')}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
