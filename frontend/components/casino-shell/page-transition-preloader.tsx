"use client"

/**
 * BetFury benzeri sayfa gecisi preloader'i: logo fade-in/out animasyonu +
 * ust kenarda kayan ilerleme cubugu. Yalnizca iframe (Vue SPA) yeniden
 * mount edildiginde (sayfa gecisi) gosterilir, ilk yuklemede degil.
 */
export function PageTransitionPreloader({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0a131e] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <img
        src="/logo.svg"
        alt=""
        className="h-10 w-auto animate-preloader-fade"
        style={{ animationPlayState: visible ? "running" : "paused" }}
      />
      <div className="h-[3px] w-40 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full w-full origin-left rounded-full bg-red-500"
          style={{
            animation: visible ? "preloader-progress 1.1s ease-in-out infinite" : "none",
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes preloader-fade {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        .animate-preloader-fade {
          animation: preloader-fade 1.5s ease-in-out infinite;
        }
        @keyframes preloader-progress {
          0% {
            transform: scaleX(0);
          }
          50% {
            transform: scaleX(0.7);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  )
}
