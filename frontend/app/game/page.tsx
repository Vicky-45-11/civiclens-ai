"use client";

import dynamic from "next/dynamic";
import { PageTitle, Spinner } from "@/components/ui";

const CrewDispatch = dynamic(() => import("@/components/CrewDispatch"), { ssr: false, loading: () => <Spinner label="Loading game" /> });

export default function GamePage() {
  return (
    <div>
      <PageTitle eyebrow="Play" title="Crew Dispatch">
        A short arcade game about the job behind every report. It is fiction: the cases are random, nothing is sent to anyone, and it does not touch real reports.
      </PageTitle>
      <CrewDispatch />
    </div>
  );
}
