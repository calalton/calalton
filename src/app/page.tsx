import { HeroSection } from "@/features/home/components/HeroSection/HeroSection";
import { HeroGlobeMark } from "@/features/home/components/HeroGlobeMark/HeroGlobeMark";
import { HomeContent } from "@/features/home/components/HomeContent/HomeContent";
import { ScrollStage } from "@/features/home/components/ScrollStage/ScrollStage";
import { DesignGrid } from "@/components/layout/DesignGrid/DesignGrid";
import { SiteNav } from "@/components/layout/SiteNav/SiteNav";

export default function Home() {
  return (
    <main>
      <ScrollStage>
        <DesignGrid />
        <HeroGlobeMark />
        <SiteNav />
        <HeroSection />
        <HomeContent />
      </ScrollStage>
    </main>
  );
}
