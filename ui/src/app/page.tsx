import { Header } from "../components/Header";
import { OrderPanel } from "../components/OrderPanel";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <OrderPanel />
      </div>
    </div>
  );
}