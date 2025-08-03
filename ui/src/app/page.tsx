import { Header } from "../components/Header";
import { OrderPanel } from "../components/OrderPanel";
import { OrdersTable } from "../components/ordersTable/index";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <OrderPanel />
        <OrdersTable />
      </div>
    </div>
  );
}