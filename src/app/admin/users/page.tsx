import type { Metadata } from "next";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsers() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { store: { select: { name: true } }, _count: { select: { orders: true } } },
  });
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th className="num">Orders</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.store && <div className="xsmall muted">{u.store.name}</div>}
              </td>
              <td className="small">{u.email}</td>
              <td>
                <span className="badge">{u.role.toLowerCase()}</span>
              </td>
              <td className="num">{u._count.orders}</td>
              <td className="num small">{u.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
