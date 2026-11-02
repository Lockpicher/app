import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => {
  return (
    <div
      style={style}
      className={`animate-pulse bg-[#1e1e2c] rounded-md ${className}`}
      aria-hidden="true"
    />
  );
};

// Full App Skeleton: shown while initial data or page chunks load
export const AppSkeletonScreen: React.FC<{ isSidebarCollapsed?: boolean }> = ({ isSidebarCollapsed = false }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#101018] text-white">
      {/* Sidebar Skeleton */}
      <aside
        className={`hidden lg:flex flex-col border-r border-[#20202e] bg-[#14141e] p-3 gap-3 transition-all ${
          isSidebarCollapsed ? 'w-[60px]' : 'w-[250px]'
        }`}
      >
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#20202e]">
          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          {!isSidebarCollapsed && (
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2 w-16 rounded" />
            </div>
          )}
        </div>

        <div className="space-y-1.5 mt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl">
              <Skeleton className="w-5 h-5 rounded shrink-0" />
              {!isSidebarCollapsed && <Skeleton className="h-3 flex-1 rounded" />}
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-[#20202e] pt-3 flex items-center gap-2">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          {!isSidebarCollapsed && <Skeleton className="h-3 flex-1 rounded" />}
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Skeleton */}
        <header className="h-14 border-b border-[#20202e] bg-[#12121c] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded lg:hidden" />
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-44 rounded-xl hidden sm:block" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </header>

        {/* Content Body Grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-hidden space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-7 w-48 rounded" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-[#171724] border border-[#26263a] rounded-2xl p-4 space-y-3 flex flex-col justify-between h-48"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-16 rounded-full" />
                    <Skeleton className="w-4 h-4 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-2/3 rounded" />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#232336]">
                  <Skeleton className="h-2.5 w-20 rounded" />
                  <Skeleton className="h-3 w-8 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

// Editor View Skeleton
export const EditorSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-[#14141c] overflow-hidden">
      <div className="h-12 border-b border-[#252538] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto w-full p-6 sm:p-10 space-y-6">
        <Skeleton className="h-9 w-3/4 rounded-lg" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-11/12 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-4 w-9/12 rounded" />
        </div>
      </div>
    </div>
  );
};
