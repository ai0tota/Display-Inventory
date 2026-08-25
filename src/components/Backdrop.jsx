// Poore app ka ambient background — ek hi jagah, ek hi baar.
// Login page se yahi values uthayi gayi hain, ab har route ke peeche hai.
const GRAIN =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27noise%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.8%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23noise)%27/%3E%3C/svg%3E")'

export default function Backdrop() {
  return (
    <div className="app-bg" aria-hidden>
      {/* Pigment blobs — app ki teen mukhya rangat */}
      <div className="app-bg-blob bg-neel w-[620px] h-[620px] top-[-15%] left-[-10%] opacity-[.38]" />
      <div className="app-bg-blob bg-gulal w-[520px] h-[520px] bottom-[-20%] right-[-15%] opacity-[.22]" />
      <div className="app-bg-blob bg-mehndi w-[420px] h-[420px] top-[45%] left-[55%] opacity-[.14]" />

      {/* Tirchhi roshni ki lakeer */}
      <div className="absolute top-[20%] -left-1/4 w-[150%] h-32 origin-center -rotate-[24deg]
                      bg-gradient-to-r from-transparent via-white/[.06] to-transparent blur-2xl" />

      {/* Scrim — sabse zaroori parat. Poore page ka contrast range dabata hai
          taaki ek hi text colour upar-baayen aur neeche-daayen ek jaisa pade. */}
      <div className="absolute inset-0 bg-[#0B1030]/55" />

      {/* Baareek daana — flat gradients ko plastic dikhne se bachata hai */}
      <div className="absolute inset-0 opacity-[.05]" style={{ backgroundImage: GRAIN }} />
    </div>
  )
}
