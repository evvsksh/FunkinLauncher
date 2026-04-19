export function SkeletonGrid() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {Array.from({ length: 10 }).map((_, i) => (
                <div
                    key={i}
                    className="bg-[#1c1c1f] border border-white/[0.07] rounded-xl overflow-hidden animate-pulse"
                >
                    <div className="aspect-video bg-white/5" />
                    <div className="p-3 space-y-2">
                        <div className="h-2.5 bg-white/10 rounded" />
                        <div className="h-2 bg-white/5 rounded w-3/5" />
                        <div className="h-7 bg-[#ff5cf0] rounded-md mt-2" />
                    </div>
                </div>
            ))}
        </div>
    );
}
