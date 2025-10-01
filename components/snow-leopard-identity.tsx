"use client"

export default function SnowLeopardIdentity() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Paw print patterns in background */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="pawprints" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              {/* Main pad */}
              <ellipse cx="50" cy="70" rx="18" ry="22" fill="currentColor" className="text-white" opacity="0.3" />
              {/* Toe pads */}
              <ellipse cx="35" cy="45" rx="10" ry="12" fill="currentColor" className="text-white" opacity="0.3" />
              <ellipse cx="50" cy="40" rx="10" ry="12" fill="currentColor" className="text-white" opacity="0.3" />
              <ellipse cx="65" cy="45" rx="10" ry="12" fill="currentColor" className="text-white" opacity="0.3" />
              <ellipse cx="75" cy="55" rx="9" ry="11" fill="currentColor" className="text-white" opacity="0.3" />

              {/* Second paw print offset */}
              <ellipse cx="150" cy="140" rx="18" ry="22" fill="currentColor" className="text-white" opacity="0.2" />
              <ellipse cx="135" cy="115" rx="10" ry="12" fill="currentColor" className="text-white" opacity="0.2" />
              <ellipse cx="150" cy="110" rx="10" ry="12" fill="currentColor" className="text-white" opacity="0.2" />
              <ellipse cx="165" cy="115" rx="10" ry="12" fill="currentColor" className="text-white" opacity="0.2" />
              <ellipse cx="175" cy="125" rx="9" ry="11" fill="currentColor" className="text-white" opacity="0.2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pawprints)" />
        </svg>
      </div>

      {/* Snow Leopard Face */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Placeholder for snow leopard - using generated image */}
        <div className="relative w-96 h-96 rounded-full overflow-hidden shadow-2xl">
          <img
            src="/majestic-snow-leopard-face-emerging-from-shadows--.jpg"
            alt="Snow Leopard"
            className="w-full h-full object-cover opacity-90 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#003D58]/20 to-[#003D58]/60"></div>
        </div>

        {/* Elegant text overlay */}
        <div className="mt-8 text-center">
          <h2 className="text-4xl font-heading font-bold text-white/90 mb-2">Luna Intelligence</h2>
          <p className="text-lg text-[#17a2b8]/80 font-medium">Powered by Nature. Driven by Innovation.</p>
        </div>

        {/* Decorative paw prints around the face */}
        <div className="absolute top-20 left-10 opacity-20">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="30" cy="40" rx="12" ry="15" fill="white" />
            <ellipse cx="20" cy="22" rx="7" ry="8" fill="white" />
            <ellipse cx="30" cy="18" rx="7" ry="8" fill="white" />
            <ellipse cx="40" cy="22" rx="7" ry="8" fill="white" />
            <ellipse cx="46" cy="30" rx="6" ry="7" fill="white" />
          </svg>
        </div>

        <div className="absolute bottom-32 right-16 opacity-15 rotate-45">
          <svg width="50" height="50" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="30" cy="40" rx="12" ry="15" fill="white" />
            <ellipse cx="20" cy="22" rx="7" ry="8" fill="white" />
            <ellipse cx="30" cy="18" rx="7" ry="8" fill="white" />
            <ellipse cx="40" cy="22" rx="7" ry="8" fill="white" />
            <ellipse cx="46" cy="30" rx="6" ry="7" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  )
}
