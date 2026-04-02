import React, { Suspense } from "react";
import ResetClient from "./ResetClient";

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto mt-24 p-6 bg-surface rounded-lg">Carregando...</div>}>
      <ResetClient />
    </Suspense>
  );
}
