import DeploymentForm from "@/components/deployment-form"
import ParticleBackground from "@/components/particle-background"
import DigitalMeshBackground from "@/components/digital-mesh-background"

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#003D58] via-[#002a3f] to-[#003D58]">
        <div className="absolute inset-0 bg-gradient-to-t from-[#003D58]/90 via-transparent to-[#F8FAFC]/5"></div>
      </div>

      <DigitalMeshBackground />

      <ParticleBackground />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <DeploymentForm />
      </div>
    </main>
  )
}
