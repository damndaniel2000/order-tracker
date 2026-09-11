"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import type { Customer, Driver } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNASSIGNED = "__unassigned__";
const NEW_CUSTOMER = "__new__";

type Props = {
  drivers: Driver[];
  onCreated: () => void;
};

const EMPTY_FORM = {
  customerId: "",
  newCustomerCode: "",
  newCustomerName: "",
  orderNumber: "",
  shippingAddress: "",
  pincode: "",
  city: "",
  receiverName: "",
  consigneeName: "",
  pickupAt: "",
  assignedDriverId: UNASSIGNED,
};

export function AddOrderDialog({ drivers, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string; password?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/customers")
      .then((res) => res.json())
      .then((data) => setCustomers((data.customers ?? []) as Customer[]));
  }, [open]);

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(EMPTY_FORM);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const isNewCustomer = form.customerId === NEW_CUSTOMER || !form.customerId;
      const payload = {
        customerId: isNewCustomer ? undefined : form.customerId,
        newCustomerCode: isNewCustomer ? form.newCustomerCode.trim() : undefined,
        newCustomerName: isNewCustomer ? form.newCustomerName.trim() : undefined,
        orderNumber: form.orderNumber.trim() || undefined,
        shippingAddress: form.shippingAddress.trim(),
        pincode: form.pincode.trim() || undefined,
        city: form.city.trim() || undefined,
        receiverName: form.receiverName.trim() || undefined,
        consigneeName: form.consigneeName.trim() || undefined,
        pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : undefined,
        assignedDriverId: form.assignedDriverId === UNASSIGNED ? undefined : form.assignedDriverId,
      };
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create order.");
      setSuccess({ orderNumber: data.orderNumber, password: data.generatedPassword });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create order.");
    } finally {
      setSubmitting(false);
    }
  }

  function copyPassword(password: string) {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const isNewCustomer = form.customerId === NEW_CUSTOMER || !form.customerId;
  const canSubmit =
    form.shippingAddress.trim() &&
    (isNewCustomer
      ? form.newCustomerCode.trim() && form.newCustomerName.trim()
      : Boolean(form.customerId));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button type="button" />}>
        <Plus className="h-4 w-4" />
        Add order
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle>Order created</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{success.orderNumber}</span> was created successfully.
              </DialogDescription>
            </DialogHeader>
            {success.password && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="mb-1">
                  New customer password (copy now — it can&apos;t be retrieved again):
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white px-2 py-1 font-mono text-xs dark:bg-zinc-900">
                    {success.password}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copyPassword(success.password!)}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add order</DialogTitle>
              <DialogDescription>Create a single order manually.</DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              <div>
                <Label className="mb-1.5">Customer</Label>
                <Select
                  value={form.customerId || NEW_CUSTOMER}
                  onValueChange={(value) => update("customerId", value ?? NEW_CUSTOMER)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_CUSTOMER}>+ New customer</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.customer_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isNewCustomer && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="newCustomerCode" className="mb-1.5">
                      Customer code
                    </Label>
                    <Input
                      id="newCustomerCode"
                      placeholder="e.g. DELL"
                      value={form.newCustomerCode}
                      onChange={(e) => update("newCustomerCode", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="newCustomerName" className="mb-1.5">
                      Customer name
                    </Label>
                    <Input
                      id="newCustomerName"
                      value={form.newCustomerName}
                      onChange={(e) => update("newCustomerName", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <Label htmlFor="orderNumber" className="mb-1.5">
                  AWB / Order number (optional — auto-generated if blank)
                </Label>
                <Input
                  id="orderNumber"
                  value={form.orderNumber}
                  onChange={(e) => update("orderNumber", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="shippingAddress" className="mb-1.5">
                  Address
                </Label>
                <Input
                  id="shippingAddress"
                  required
                  value={form.shippingAddress}
                  onChange={(e) => update("shippingAddress", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="city" className="mb-1.5">
                    City
                  </Label>
                  <Input id="city" value={form.city} onChange={(e) => update("city", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pincode" className="mb-1.5">
                    Pincode
                  </Label>
                  <Input
                    id="pincode"
                    value={form.pincode}
                    onChange={(e) => update("pincode", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="consigneeName" className="mb-1.5">
                    To (consignee)
                  </Label>
                  <Input
                    id="consigneeName"
                    value={form.consigneeName}
                    onChange={(e) => update("consigneeName", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="receiverName" className="mb-1.5">
                    Receiver name
                  </Label>
                  <Input
                    id="receiverName"
                    value={form.receiverName}
                    onChange={(e) => update("receiverName", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="pickupAt" className="mb-1.5">
                  Pickup date &amp; time (optional)
                </Label>
                <Input
                  id="pickupAt"
                  type="datetime-local"
                  value={form.pickupAt}
                  onChange={(e) => update("pickupAt", e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-1.5">Driver (optional)</Label>
                <Select
                  value={form.assignedDriverId}
                  onValueChange={(value) => update("assignedDriverId", value ?? UNASSIGNED)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.display_name} ({d.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <DialogFooter showCloseButton>
              <Button type="button" disabled={!canSubmit || submitting} onClick={handleSubmit}>
                {submitting ? "Creating…" : "Create order"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
