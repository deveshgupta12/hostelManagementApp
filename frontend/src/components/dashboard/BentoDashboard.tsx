import { FormEvent, useEffect, useMemo, useState } from "react";
import { BellRing, IndianRupee, ShieldCheck, UtensilsCrossed } from "lucide-react";

import type { DashboardTab } from "@/components/layout/BottomNav";
import { Switch } from "@/components/ui/switch";

interface FeatureState {
  mess: boolean;
  gate_access: boolean;
  gst: boolean;
}

type BentoDashboardProps = {
  activeTab: DashboardTab;
  token: string;
  onAuthError: () => void;
};

type FeatureSettingResponse = {
  feature_name: keyof FeatureState;
  enabled: boolean;
};

type RoomItem = {
  id: number;
  room_number: string;
  capacity: number;
  daily_rent: number;
  active_residents: number;
};

type ManagedResidentItem = {
  resident_id: number;
  full_name: string;
  email: string;
  phone_number: string | null;
  parent_name: string | null;
  parent_phone_number: string | null;
  room_id: number;
  room_number: string;
  monthly_rent: number | null;
  due_amount: number;
  check_in_date: string;
  check_out_date: string | null;
  is_long_term_residential: boolean;
};

type ResidentsView = "menu" | "add" | "current" | "past" | "edit";

type TransactionItem = {
  id: number;
  resident_id: number;
  resident_name: string;
  room_number: string;
  description: string;
  base_amount: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  created_at: string;
};

type ResidentLedger = {
  resident_id: number;
  resident_name: string;
  room_number: string;
  total_received: number;
  entries: TransactionItem[];
};

type MonthlySummary = {
  year: number;
  month: number;
  total_received: number;
  total_base_amount: number;
  total_gst_collected: number;
  transaction_count: number;
};

type ReceiptPayload = {
  receipt_number: string;
  generated_at: string;
  transaction: TransactionItem;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const DEFAULT_ROOM_DAILY_RENT = 1200;
const FUNCTION_WINDOW_CLASS = "rounded-3xl border border-slate-200 bg-white p-4 shadow-panel";

export function BentoDashboard({ activeTab, token, onAuthError }: BentoDashboardProps) {
  const [features, setFeatures] = useState<FeatureState>({
    mess: true,
    gate_access: true,
    gst: true,
  });
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [residents, setResidents] = useState<ManagedResidentItem[]>([]);
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<ResidentLedger | null>(null);
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [monthlyYear, setMonthlyYear] = useState<number>(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState<number>(new Date().getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messMenuItems, setMessMenuItems] = useState<string[]>([]);
  const [gateResult, setGateResult] = useState<string>("");
  const [gstResult, setGstResult] = useState<string>("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("1");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editRoomCapacity, setEditRoomCapacity] = useState("1");
  const [residentName, setResidentName] = useState("");
  const [residentEmail, setResidentEmail] = useState("");
  const [residentPhone, setResidentPhone] = useState("");
  const [residentParentName, setResidentParentName] = useState("");
  const [residentParentPhone, setResidentParentPhone] = useState("");
  const [residentPassword, setResidentPassword] = useState("Student@123");
  const [residentRoomId, setResidentRoomId] = useState("");
  const [residentMonthlyRent, setResidentMonthlyRent] = useState("");
  const [residentCheckInDate, setResidentCheckInDate] = useState(new Date().toISOString().slice(0, 10));
  const [residentLongTerm, setResidentLongTerm] = useState(true);
  const [rentMonth, setRentMonth] = useState(String(new Date().getMonth() + 1));
  const [rentYear, setRentYear] = useState(String(new Date().getFullYear()));
  const [rentDays, setRentDays] = useState("");
  const [rentDescription, setRentDescription] = useState("Monthly rent collection");
  const [editResidentId, setEditResidentId] = useState<string>("");
  const [editResidentName, setEditResidentName] = useState("");
  const [editResidentEmail, setEditResidentEmail] = useState("");
  const [editResidentPhone, setEditResidentPhone] = useState("");
  const [editResidentParentName, setEditResidentParentName] = useState("");
  const [editResidentParentPhone, setEditResidentParentPhone] = useState("");
  const [editResidentRoomId, setEditResidentRoomId] = useState("");
  const [editResidentMonthlyRent, setEditResidentMonthlyRent] = useState("");
  const [editResidentCheckInDate, setEditResidentCheckInDate] = useState("");
  const [editResidentCheckOutDate, setEditResidentCheckOutDate] = useState("");
  const [editResidentLongTerm, setEditResidentLongTerm] = useState(true);
  const [residentsView, setResidentsView] = useState<ResidentsView>("menu");

  const cards = useMemo(
    () => [
      {
        title: "Mess Module",
        key: "mess" as const,
        icon: UtensilsCrossed,
        desc: "Enable meal operations and attendance for all hostels.",
      },
      {
        title: "Gate Access",
        key: "gate_access" as const,
        icon: ShieldCheck,
        desc: "Control resident in/out logs and security checkpoints.",
      },
      {
        title: "GST Billing",
        key: "gst" as const,
        icon: IndianRupee,
        desc: "Apply GST rules to eligible transactions.",
      },
    ],
    [],
  );

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const getErrorMessage = async (response: Response, fallback: string): Promise<string> => {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    return payload?.detail ?? fallback;
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const roomsResponse = await fetch(`${API_BASE_URL}/api/v1/rooms`, { headers: authHeaders });
      if (roomsResponse.status === 401) {
        onAuthError();
        return;
      }

      if (!roomsResponse.ok) {
        throw new Error("Unable to load rooms from server.");
      }

      const roomPayload = (await roomsResponse.json()) as RoomItem[];
      setRooms(roomPayload);

      if (!selectedRoomId && roomPayload.length > 0) {
        setSelectedRoomId(String(roomPayload[0].id));
        setEditRoomNumber(roomPayload[0].room_number);
        setEditRoomCapacity(String(roomPayload[0].capacity));
      }
      if (!residentRoomId && roomPayload.length > 0) {
        setResidentRoomId(String(roomPayload[0].id));
      }

      const [featuresResponse, residentsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/features`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/api/v1/residents/manage`, { headers: authHeaders }),
      ]);

      if (featuresResponse.status === 401 || residentsResponse.status === 401) {
        onAuthError();
        return;
      }

      if (!featuresResponse.ok) {
        throw new Error("Unable to load features from server.");
      }

      const featurePayload = (await featuresResponse.json()) as FeatureSettingResponse[];
      setFeatures((prev) => {
        const next = { ...prev };
        featurePayload.forEach((item) => {
          next[item.feature_name] = item.enabled;
        });
        return next;
      });

      if (!residentsResponse.ok) {
        throw new Error("Unable to load residents from server.");
      }

      const residentPayload = (await residentsResponse.json()) as ManagedResidentItem[];
      setResidents(residentPayload);
      if (residentPayload.length > 0 && selectedResidentId === null) {
        setSelectedResidentId(residentPayload[0].resident_id);
      }
      if (!editResidentId && residentPayload.length > 0) {
        const firstResident = residentPayload[0];
        setEditResidentId(String(firstResident.resident_id));
        setEditResidentName(firstResident.full_name);
        setEditResidentEmail(firstResident.email);
        setEditResidentPhone(firstResident.phone_number ?? "");
        setEditResidentParentName(firstResident.parent_name ?? "");
        setEditResidentParentPhone(firstResident.parent_phone_number ?? "");
        setEditResidentRoomId(String(firstResident.room_id));
        setEditResidentMonthlyRent(firstResident.monthly_rent !== null ? String(firstResident.monthly_rent) : "");
        setEditResidentCheckInDate(firstResident.check_in_date);
        setEditResidentCheckOutDate(firstResident.check_out_date ?? "");
        setEditResidentLongTerm(firstResident.is_long_term_residential);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load data.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthlySummary = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/billing/monthly-summary?year=${monthlyYear}&month=${monthlyMonth}`,
        {
          headers: authHeaders,
        },
      );

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to load monthly summary."));
      }

      const payload = (await response.json()) as MonthlySummary;
      setMonthlySummary(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load monthly summary.";
      setError(message);
    }
  };

  useEffect(() => {
    void loadDashboardData();
    void loadMonthlySummary();
  }, [token]);

  useEffect(() => {
    if (selectedResidentId) {
      void loadLedger(selectedResidentId);
    }
  }, [selectedResidentId]);

  const loadLedger = async (residentId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/billing/residents/${residentId}/ledger`, {
        headers: authHeaders,
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to load resident ledger."));
      }

      const payload = (await response.json()) as ResidentLedger;
      setLedger(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load resident ledger.";
      setError(message);
    }
  };

  const toggleFeature = async (key: keyof FeatureState) => {
    const nextEnabled = !features[key];
    setFeatures((prev) => ({ ...prev, [key]: nextEnabled }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/features/${key}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ enabled: nextEnabled }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to update feature."));
      }
    } catch {
      setFeatures((prev) => ({ ...prev, [key]: !nextEnabled }));
      setError("Feature update failed. Please try again.");
    }
  };

  const onCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/rooms`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          room_number: roomNumber,
          capacity: Number(roomCapacity),
          daily_rent: DEFAULT_ROOM_DAILY_RENT,
        }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to create room."));
      }

      const created = (await response.json()) as RoomItem;
      setRooms((prev) => [...prev, created].sort((a, b) => a.room_number.localeCompare(b.room_number)));
      setSelectedRoomId(String(created.id));
      setEditRoomNumber(created.room_number);
      setEditRoomCapacity(String(created.capacity));
      setRoomNumber("");
      setRoomCapacity("1");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to create room.";
      try {
        const roomsResponse = await fetch(`${API_BASE_URL}/api/v1/rooms`, { headers: authHeaders });
        if (roomsResponse.ok) {
          const latestRooms = (await roomsResponse.json()) as RoomItem[];
          setRooms(latestRooms);
          const normalizedInput = roomNumber.trim().toLowerCase();
          const matchingRoom = latestRooms.find((room) => room.room_number.trim().toLowerCase() === normalizedInput);
          if (matchingRoom) {
            onSelectRoomForEdit(String(matchingRoom.id));
          }
        }
      } catch {
      }
      setError(message);
    }
  };

  const onSelectRoomForEdit = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rooms.find((item) => item.id === Number(roomId));
    if (!room) {
      return;
    }
    setEditRoomNumber(room.room_number);
    setEditRoomCapacity(String(room.capacity));
  };

  const onUpdateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoomId) {
      setError("Select a room to edit.");
      return;
    }

    const roomToUpdate = rooms.find((room) => room.id === Number(selectedRoomId));
    if (!roomToUpdate) {
      setError("Selected room not found.");
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${selectedRoomId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          room_number: editRoomNumber,
          capacity: Number(editRoomCapacity),
          daily_rent: roomToUpdate.daily_rent,
        }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to update room."));
      }

      const updated = (await response.json()) as RoomItem;
      setRooms((prev) =>
        prev
          .map((room) => (room.id === updated.id ? updated : room))
          .sort((a, b) => a.room_number.localeCompare(b.room_number)),
      );
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update room.";
      setError(message);
    }
  };

  const onDeleteRoom = async () => {
    if (!selectedRoomId) {
      setError("Select a room to delete.");
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/rooms/${selectedRoomId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to delete room."));
      }

      const nextRooms = rooms.filter((room) => room.id !== Number(selectedRoomId));
      setRooms(nextRooms);
      if (nextRooms.length > 0) {
        onSelectRoomForEdit(String(nextRooms[0].id));
      } else {
        setSelectedRoomId("");
        setEditRoomNumber("");
        setEditRoomCapacity("1");
      }
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete room.";
      setError(message);
    }
  };

  const onAssignResident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/residents`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          full_name: residentName,
          email: residentEmail,
          phone_number: residentPhone || null,
          parent_name: residentParentName,
          parent_phone_number: residentParentPhone,
          password: residentPassword,
          room_id: Number(residentRoomId),
          monthly_rent: residentMonthlyRent ? Number(residentMonthlyRent) : null,
          check_in_date: residentCheckInDate,
          is_long_term_residential: residentLongTerm,
        }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to assign resident."));
      }

      const created = (await response.json()) as ManagedResidentItem;
      setResidents((prev) => [...prev, created]);
      setResidentName("");
      setResidentEmail("");
      setResidentPhone("");
      setResidentParentName("");
      setResidentParentPhone("");
      setResidentMonthlyRent("");
      setSelectedResidentId(created.resident_id);
      setResidentsView("current");
      await loadDashboardData();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to assign resident.";
      setError(message);
    }
  };

  const onSelectResidentForEdit = (residentId: string) => {
    setEditResidentId(residentId);
    const resident = residents.find((item) => item.resident_id === Number(residentId));
    if (!resident) {
      return;
    }
    setEditResidentName(resident.full_name);
    setEditResidentEmail(resident.email);
    setEditResidentPhone(resident.phone_number ?? "");
    setEditResidentParentName(resident.parent_name ?? "");
    setEditResidentParentPhone(resident.parent_phone_number ?? "");
    setEditResidentRoomId(String(resident.room_id));
    setEditResidentMonthlyRent(resident.monthly_rent !== null ? String(resident.monthly_rent) : "");
    setEditResidentCheckInDate(resident.check_in_date);
    setEditResidentCheckOutDate(resident.check_out_date ?? "");
    setEditResidentLongTerm(resident.is_long_term_residential);
  };

  const onUpdateResident = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editResidentId) {
      setError("Select a resident to edit.");
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/residents/${editResidentId}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          full_name: editResidentName,
          email: editResidentEmail,
          phone_number: editResidentPhone || null,
          parent_name: editResidentParentName,
          parent_phone_number: editResidentParentPhone,
          room_id: Number(editResidentRoomId),
          monthly_rent: editResidentMonthlyRent ? Number(editResidentMonthlyRent) : null,
          check_in_date: editResidentCheckInDate,
          check_out_date: editResidentCheckOutDate || null,
          is_long_term_residential: editResidentLongTerm,
        }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to update resident."));
      }

      const updated = (await response.json()) as ManagedResidentItem;
      setResidents((prev) => prev.map((resident) => (resident.resident_id === updated.resident_id ? updated : resident)));
      setSelectedResidentId(updated.resident_id);
      setResidentsView(updated.check_out_date ? "past" : "current");
      await loadDashboardData();
      await loadLedger(updated.resident_id);
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update resident.";
      setError(message);
    }
  };

  const onCheckoutResident = async (residentId: number) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/residents/${residentId}/checkout`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to checkout resident."));
      }

      const updated = (await response.json()) as ManagedResidentItem;
      setResidents((prev) => prev.map((resident) => (resident.resident_id === updated.resident_id ? updated : resident)));
      setResidentsView("past");
      if (selectedResidentId === updated.resident_id) {
        await loadLedger(updated.resident_id);
      }
      await loadDashboardData();
    } catch (checkoutError) {
      const message = checkoutError instanceof Error ? checkoutError.message : "Unable to checkout resident.";
      setError(message);
    }
  };

  const onDeletePastResident = async (residentId: number) => {
    const shouldDelete = window.confirm("Delete this past resident from the list?");
    if (!shouldDelete) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/residents/${residentId}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to delete resident."));
      }

      setResidents((prev) => prev.filter((resident) => resident.resident_id !== residentId));
      if (selectedResidentId === residentId) {
        setSelectedResidentId(null);
        setLedger(null);
        setReceipt(null);
      }
      await loadDashboardData();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete resident.";
      setError(message);
    }
  };

  const onCollectRent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedResidentId) {
      setError("Select a resident first.");
      return;
    }

    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/billing/collect`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          resident_id: selectedResidentId,
          month: Number(rentMonth),
          year: Number(rentYear),
          days: rentDays ? Number(rentDays) : null,
          description: rentDescription || null,
        }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to collect rent."));
      }

      const transaction = (await response.json()) as TransactionItem;
      await loadLedger(selectedResidentId);
      await loadMonthlySummary();
      setReceipt(null);
      setRentDescription("Monthly rent collection");
      setGateResult(`Collected ₹${transaction.total_amount} for ${transaction.resident_name} (${rentMonth}/${rentYear})`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to collect rent.";
      setError(message);
    }
  };

  const onGenerateReceipt = async (transactionId: number) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/billing/transactions/${transactionId}/receipt`, {
        headers: authHeaders,
      });
      if (response.status === 401) {
        onAuthError();
        return;
      }
      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Unable to generate receipt."));
      }

      const payload = (await response.json()) as ReceiptPayload;
      setReceipt(payload);
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : "Unable to generate receipt.";
      setError(message);
    }
  };

  const downloadReceipt = () => {
    if (!receipt) {
      return;
    }
    const content = [
      `Receipt No: ${receipt.receipt_number}`,
      `Generated At: ${receipt.generated_at}`,
      `Resident: ${receipt.transaction.resident_name}`,
      `Room: ${receipt.transaction.room_number}`,
      `Description: ${receipt.transaction.description}`,
      `Base Amount: ₹${receipt.transaction.base_amount}`,
      `GST Rate: ${receipt.transaction.gst_rate}%`,
      `GST Amount: ₹${receipt.transaction.gst_amount}`,
      `Total Received: ₹${receipt.transaction.total_amount}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${receipt.receipt_number}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toCsvCell = (value: string | number | null) => {
    const normalized = value === null ? "" : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const downloadCsv = (fileName: string, rows: Array<Array<string | number | null>>) => {
    const csvContent = rows
      .map((row) => (row.length === 0 ? "" : row.map((cell) => toCsvCell(cell)).join(",")))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadManagementReportCsv = () => {
    const rows: Array<Array<string | number | null>> = [];

    rows.push(["section", "month", "year", "total_received", "base_amount", "gst_collected", "transactions"]);
    rows.push([
      "monthly_summary",
      monthlySummary?.month ?? "",
      monthlySummary?.year ?? "",
      monthlySummary?.total_received ?? "",
      monthlySummary?.total_base_amount ?? "",
      monthlySummary?.total_gst_collected ?? "",
      monthlySummary?.transaction_count ?? "",
    ]);

    rows.push([]);
    rows.push(["section", "room_number", "active_residents", "capacity"]);
    rooms.forEach((room) => {
      rows.push([
        "room",
        room.room_number,
        room.active_residents,
        room.capacity,
      ]);
    });

    rows.push([]);
    rows.push(["section", "resident_name", "email", "phone", "room", "monthly_rent", "check_in", "check_out"]);
    residents.forEach((resident) => {
      rows.push([
        "resident",
        resident.full_name,
        resident.email,
        resident.phone_number,
        resident.room_number,
        resident.monthly_rent,
        resident.check_in_date,
        resident.check_out_date,
      ]);
    });

    downloadCsv(`hostel-report-${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}.csv`, rows);
  };

  const downloadRoomsCsv = () => {
    const rows: Array<Array<string | number | null>> = [];
    rows.push(["room_number", "active_residents", "capacity"]);
    rooms.forEach((room) => {
      rows.push([room.room_number, room.active_residents, room.capacity]);
    });
    downloadCsv(`rooms-report-${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}.csv`, rows);
  };

  const downloadResidentsCsv = () => {
    const rows: Array<Array<string | number | null>> = [];
    rows.push(["resident_name", "email", "phone", "room", "monthly_rent", "check_in", "check_out"]);
    residents.forEach((resident) => {
      rows.push([
        resident.full_name,
        resident.email,
        resident.phone_number,
        resident.room_number,
        resident.monthly_rent,
        resident.check_in_date,
        resident.check_out_date,
      ]);
    });
    downloadCsv(`residents-report-${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}.csv`, rows);
  };

  const downloadMonthlySummaryCsv = () => {
    const rows: Array<Array<string | number | null>> = [];
    rows.push(["month", "year", "total_received", "base_amount", "gst_collected", "transactions"]);
    rows.push([
      monthlySummary?.month ?? monthlyMonth,
      monthlySummary?.year ?? monthlyYear,
      monthlySummary?.total_received ?? 0,
      monthlySummary?.total_base_amount ?? 0,
      monthlySummary?.total_gst_collected ?? 0,
      monthlySummary?.transaction_count ?? 0,
    ]);
    downloadCsv(`monthly-collection-${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}.csv`, rows);
  };

  const runMessMenuCheck = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/modules/mess/menu`, {
        method: "GET",
        headers: authHeaders,
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load mess menu.");
      }

      const payload = (await response.json()) as { items: string[] };
      setMessMenuItems(payload.items);
    } catch {
      setError("Mess menu request failed.");
    }
  };

  const runGateCheckin = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/modules/gate/checkin`, {
        method: "POST",
        headers: authHeaders,
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error("Gate check-in failed.");
      }

      const payload = (await response.json()) as { status: string; module: string };
      setGateResult(`${payload.module}: ${payload.status}`);
    } catch {
      setError("Gate check-in failed.");
    }
  };

  const runGstPreview = async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/modules/gst/calculate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ daily_rent: 1200, days: 1, is_long_term_residential: true }),
      });

      if (response.status === 401) {
        onAuthError();
        return;
      }

      if (!response.ok) {
        throw new Error("GST preview failed.");
      }

      const payload = (await response.json()) as { gst_rate_percent: number; gst_amount: number; total_amount: number };
      setGstResult(`GST ${payload.gst_rate_percent}% • Amount ₹${payload.gst_amount} • Total ₹${payload.total_amount}`);
    } catch {
      setError("GST preview failed.");
    }
  };

  const activeResidents = useMemo(
    () => residents.filter((resident) => resident.check_out_date === null),
    [residents],
  );

  const pastResidents = useMemo(
    () => residents.filter((resident) => resident.check_out_date !== null),
    [residents],
  );

  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

  const selectedRentMonth = Number(rentMonth) || new Date().getMonth() + 1;
  const selectedRentYear = Number(rentYear) || new Date().getFullYear();
  const effectiveRentDays = Number(rentDays) || getDaysInMonth(selectedRentYear, selectedRentMonth);

  const hostelOverview = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter((room) => room.active_residents > 0).length;
    const vacantRooms = Math.max(totalRooms - occupiedRooms, 0);
    const vacantRoomNumbers = rooms
      .filter((room) => room.active_residents === 0)
      .map((room) => room.room_number)
      .sort((a, b) => a.localeCompare(b));
    const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
    const occupiedBeds = rooms.reduce((sum, room) => sum + room.active_residents, 0);
    const vacantBeds = Math.max(totalCapacity - occupiedBeds, 0);
    const occupancyRate = totalCapacity > 0 ? (occupiedBeds / totalCapacity) * 100 : 0;

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      vacantRoomNumbers,
      totalCapacity,
      occupiedBeds,
      vacantBeds,
      occupancyRate,
      activeResidents: activeResidents.length,
      pastResidents: pastResidents.length,
    };
  }, [rooms, activeResidents.length, pastResidents.length]);

  return (
    <section className="mx-auto max-w-md px-4 pb-24 pt-6">
      <header className="mb-5 rounded-3xl bg-gradient-to-r from-emerald-900 to-teal-700 p-5 text-white shadow-panel">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">HostelHub India</p>
        <h1 className="font-display text-2xl">Super Admin Console</h1>
        <p className="mt-2 text-sm text-emerald-50">Unified controls for compliance and operations.</p>
      </header>

      {isLoading ? <p className="mb-4 text-sm text-slate-700">Loading dashboard...</p> : null}
      {error ? <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {activeTab === "overview" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <article className="col-span-2 rounded-3xl bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg text-slate-900">Hostel Dashboard</h2>
                  <p className="text-sm text-slate-600">Live occupancy and capacity snapshot</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
                  {hostelOverview.occupancyRate.toFixed(1)}% occupied
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-100 px-3 py-2">
                  <p className="text-slate-600">Total rooms</p>
                  <p className="font-semibold text-slate-900">{hostelOverview.totalRooms}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-emerald-700">Occupied rooms</p>
                  <p className="font-semibold text-emerald-900">{hostelOverview.occupiedRooms}</p>
                </div>
                <div className="rounded-xl bg-teal-50 px-3 py-2">
                  <p className="text-teal-700">Vacant rooms</p>
                  <p className="font-semibold text-teal-900">{hostelOverview.vacantRooms}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-2">
                  <p className="text-slate-600">Total beds</p>
                  <p className="font-semibold text-slate-900">{hostelOverview.totalCapacity}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2">
                  <p className="text-emerald-700">Occupied beds</p>
                  <p className="font-semibold text-emerald-900">{hostelOverview.occupiedBeds}</p>
                </div>
                <div className="rounded-xl bg-teal-50 px-3 py-2">
                  <p className="text-teal-700">Vacant beds</p>
                  <p className="font-semibold text-teal-900">{hostelOverview.vacantBeds}</p>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <p>Active residents: {hostelOverview.activeResidents}</p>
                <p>Past residents: {hostelOverview.pastResidents}</p>
              </div>
              {hostelOverview.vacantRoomNumbers.length > 0 && (
                <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2">
                  <p className="text-xs font-semibold text-teal-700">Vacant Rooms</p>
                  <p className="mt-1 text-sm text-teal-900">{hostelOverview.vacantRoomNumbers.join(", ")}</p>
                </div>
              )}
            </article>
          </div>
        </>
      ) : null}

      {activeTab === "rooms" ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Function windows • Rooms</p>
          <article className={FUNCTION_WINDOW_CLASS}>
            <h2 className="font-display text-lg text-slate-900">Add Room</h2>
            <form onSubmit={onCreateRoom} className="mt-3 grid grid-cols-1 gap-2">
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Room number</span>
                <input
                  value={roomNumber}
                  onChange={(event) => setRoomNumber(event.target.value)}
                  placeholder="Room number (e.g. A-101)"
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Capacity</span>
                <input
                  type="number"
                  value={roomCapacity}
                  onChange={(event) => setRoomCapacity(event.target.value)}
                  min={1}
                  placeholder="Capacity"
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                />
              </label>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
              >
                Create Room
              </button>
            </form>
          </article>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Edit Room</h3>
            <form onSubmit={onUpdateRoom} className="mt-3 grid grid-cols-1 gap-2">
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Select room</span>
                <select
                  value={selectedRoomId}
                  onChange={(event) => onSelectRoomForEdit(event.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                >
                  <option value="">Select room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Room number</span>
                <input
                  value={editRoomNumber}
                  onChange={(event) => setEditRoomNumber(event.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Capacity</span>
                <input
                  type="number"
                  value={editRoomCapacity}
                  onChange={(event) => setEditRoomCapacity(event.target.value)}
                  min={1}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
                >
                  Update Room
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteRoom()}
                  className="min-h-[44px] rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white"
                >
                  Delete Room
                </button>
              </div>
            </form>
          </article>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Rooms List</h3>
            {rooms.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No rooms found yet. Add your first room above.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-2">
                {rooms.map((room) => (
                  <li key={room.id} className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Room {room.room_number}</p>
                    <p>Capacity {room.active_residents}/{room.capacity}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === "residents" ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Function windows • Residents</p>
          <article className={FUNCTION_WINDOW_CLASS}>
            <h2 className="font-display text-lg text-slate-900">Residents Actions</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setResidentsView("add")} className="min-h-[44px] rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white">
                Add New Resident
              </button>
              <button type="button" onClick={() => setResidentsView("current")} className="min-h-[44px] rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white">
                View Current
              </button>
              <button type="button" onClick={() => setResidentsView("past")} className="min-h-[44px] rounded-xl bg-teal-700 px-3 text-xs font-semibold text-white">
                View Past
              </button>
            </div>
          </article>

          {residentsView === "add" ? (
            <article className={FUNCTION_WINDOW_CLASS}>
              <h2 className="font-display text-lg text-slate-900">Add New Resident</h2>
              <form onSubmit={onAssignResident} className="mt-3 grid grid-cols-1 gap-2">
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident full name</span>
                  <input value={residentName} onChange={(event) => setResidentName(event.target.value)} placeholder="Resident full name" className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident email</span>
                  <input type="email" value={residentEmail} onChange={(event) => setResidentEmail(event.target.value)} placeholder="Resident email" className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident phone number</span>
                  <input type="text" value={residentPhone} onChange={(event) => setResidentPhone(event.target.value)} placeholder="Resident phone number" className="min-h-[44px] rounded-xl border border-slate-300 px-3" />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Parent name</span>
                  <input type="text" value={residentParentName} onChange={(event) => setResidentParentName(event.target.value)} placeholder="Parent name" className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Parent phone number</span>
                  <input type="text" value={residentParentPhone} onChange={(event) => setResidentParentPhone(event.target.value)} placeholder="Parent phone number" className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident password</span>
                  <input type="text" value={residentPassword} onChange={(event) => setResidentPassword(event.target.value)} placeholder="Resident password" className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Assign room</span>
                  <select value={residentRoomId} onChange={(event) => setResidentRoomId(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required>
                    <option value="">Select room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.room_number} ({room.active_residents}/{room.capacity})</option>
                    ))}
                  </select>
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Monthly rent</span>
                  <input type="number" value={residentMonthlyRent} onChange={(event) => setResidentMonthlyRent(event.target.value)} min={1} step="0.01" placeholder="Monthly rent" className="min-h-[44px] rounded-xl border border-slate-300 px-3" />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Check-in date</span>
                  <input type="date" value={residentCheckInDate} onChange={(event) => setResidentCheckInDate(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={residentLongTerm} onChange={(event) => setResidentLongTerm(event.target.checked)} />
                  Long-term residential
                </label>
                <button type="submit" className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">Add Resident</button>
              </form>
            </article>
          ) : null}

          {residentsView === "edit" ? (
            <article className={FUNCTION_WINDOW_CLASS}>
              <h3 className="font-display text-base text-slate-900">Edit Resident</h3>
              <form onSubmit={onUpdateResident} className="mt-3 grid grid-cols-1 gap-2">
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident full name</span>
                  <input value={editResidentName} onChange={(event) => setEditResidentName(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident email</span>
                  <input type="email" value={editResidentEmail} onChange={(event) => setEditResidentEmail(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Resident phone number</span>
                  <input type="text" value={editResidentPhone} onChange={(event) => setEditResidentPhone(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Parent name</span>
                  <input type="text" value={editResidentParentName} onChange={(event) => setEditResidentParentName(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Parent phone number</span>
                  <input type="text" value={editResidentParentPhone} onChange={(event) => setEditResidentParentPhone(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Assigned room</span>
                  <select value={editResidentRoomId} onChange={(event) => setEditResidentRoomId(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required>
                    <option value="">Select room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.room_number}</option>
                    ))}
                  </select>
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Monthly rent</span>
                  <input type="number" value={editResidentMonthlyRent} onChange={(event) => setEditResidentMonthlyRent(event.target.value)} min={1} step="0.01" className="min-h-[44px] rounded-xl border border-slate-300 px-3" />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Check-in date</span>
                  <input type="date" value={editResidentCheckInDate} onChange={(event) => setEditResidentCheckInDate(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" required />
                </label>
                <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                  <span>Check-out date (optional)</span>
                  <input type="date" value={editResidentCheckOutDate} onChange={(event) => setEditResidentCheckOutDate(event.target.value)} className="min-h-[44px] rounded-xl border border-slate-300 px-3" />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={editResidentLongTerm} onChange={(event) => setEditResidentLongTerm(event.target.checked)} />
                  Long-term residential
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="submit" className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white">Update Resident</button>
                  <button type="button" onClick={() => setResidentsView(editResidentCheckOutDate ? "past" : "current")} className="min-h-[44px] rounded-xl bg-slate-700 px-4 text-sm font-semibold text-white">Cancel</button>
                </div>
              </form>
            </article>
          ) : null}

          {residentsView === "current" ? (
            <article className={FUNCTION_WINDOW_CLASS}>
              <h3 className="font-display text-base text-slate-900">Current Residents</h3>
              {activeResidents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No current residents right now.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-2">
                  {activeResidents.map((resident) => (
                    <li key={resident.resident_id} className="rounded-xl bg-slate-100 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800">{resident.full_name}</p>
                      <p className="text-xs text-slate-600">Room {resident.room_number} • Due ₹{resident.due_amount.toFixed(2)}</p>
                      <p className="text-xs text-slate-600">Parent: {resident.parent_name || "-"} • {resident.parent_phone_number || "-"}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => resident.phone_number && (window.location.href = `tel:${resident.phone_number}`)} className="min-h-[36px] rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white">Call Resident</button>
                        <button type="button" onClick={() => resident.parent_phone_number && (window.location.href = `tel:${resident.parent_phone_number}`)} className="min-h-[36px] rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white">Call Parent</button>
                        <button type="button" onClick={() => setSelectedResidentId(resident.resident_id)} className="min-h-[36px] rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">View Ledger</button>
                        <button type="button" onClick={() => { onSelectResidentForEdit(String(resident.resident_id)); setResidentsView("edit"); }} className="min-h-[36px] rounded-lg bg-indigo-700 px-3 text-xs font-semibold text-white">Edit</button>
                        <button type="button" onClick={() => void onCheckoutResident(resident.resident_id)} className="col-span-2 min-h-[36px] rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white">Move to Past Residents</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}

          {residentsView === "past" ? (
            <article className={FUNCTION_WINDOW_CLASS}>
              <h3 className="font-display text-base text-slate-900">Past Residents</h3>
              {pastResidents.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">No past residents yet.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-2">
                  {pastResidents.map((resident) => (
                    <li key={resident.resident_id} className="rounded-xl bg-slate-100 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-800">{resident.full_name}</p>
                      <p className="text-xs text-slate-600">Room {resident.room_number}</p>
                      <p className="text-xs text-slate-600">Check-out {resident.check_out_date}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setSelectedResidentId(resident.resident_id)} className="min-h-[36px] rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">View Ledger</button>
                        <button type="button" onClick={() => { onSelectResidentForEdit(String(resident.resident_id)); setResidentsView("edit"); }} className="min-h-[36px] rounded-lg bg-indigo-700 px-3 text-xs font-semibold text-white">Edit</button>
                        <button type="button" onClick={() => void onDeletePastResident(resident.resident_id)} className="col-span-2 min-h-[36px] rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white">Delete from Past Residents</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : null}

          <article className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Collect Rent</h3>
            <form onSubmit={onCollectRent} className="mt-3 grid grid-cols-1 gap-2">
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Resident</span>
                <select
                  value={selectedResidentId ?? ""}
                  onChange={(event) => setSelectedResidentId(event.target.value ? Number(event.target.value) : null)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                >
                  <option value="">Select resident</option>
                  {activeResidents.map((resident) => (
                    <option key={resident.resident_id} value={resident.resident_id}>
                      {resident.full_name} ({resident.room_number})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Billing month (1-12)</span>
                <input
                  type="number"
                  value={rentMonth}
                  onChange={(event) => setRentMonth(event.target.value)}
                  min={1}
                  max={12}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Billing year</span>
                <input
                  type="number"
                  value={rentYear}
                  onChange={(event) => setRentYear(event.target.value)}
                  min={2000}
                  max={2100}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  required
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Days override (optional)</span>
                <input
                  type="number"
                  value={rentDays}
                  onChange={(event) => setRentDays(event.target.value)}
                  min={1}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  placeholder={`Default: ${effectiveRentDays} days`}
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Description</span>
                <input
                  type="text"
                  value={rentDescription}
                  onChange={(event) => setRentDescription(event.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                  placeholder="Description"
                />
              </label>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
              >
                Collect Amount
              </button>
            </form>
          </article>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Resident Ledger & Receipt Generation</h3>
            {ledger === null ? (
              <p className="mt-2 text-sm text-slate-600">Select a resident to view ledger.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-700">
                  {ledger.resident_name} • Room {ledger.room_number}
                </p>
                <p className="text-sm font-semibold text-emerald-800">Total received: ₹{ledger.total_received}</p>
                {ledger.entries.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">No transactions yet.</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 gap-2">
                    {ledger.entries.map((entry) => (
                      <li key={entry.id} className="rounded-xl bg-slate-100 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-800">#{entry.id} • ₹{entry.total_amount}</p>
                        <p className="text-xs text-slate-600">{entry.description}</p>
                        <p className="text-xs text-slate-600">Base ₹{entry.base_amount} • GST ₹{entry.gst_amount}</p>
                        <button
                          type="button"
                          onClick={() => onGenerateReceipt(entry.id)}
                          className="mt-2 min-h-[36px] rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white"
                        >
                          Generate Receipt File
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </article>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Generated Receipt</h3>
            {receipt ? (
              <div className="rounded-xl bg-slate-100 p-3">
                <p className="text-sm font-semibold text-slate-900">{receipt.receipt_number}</p>
                <p className="text-xs text-slate-600">{receipt.generated_at}</p>
                <p className="mt-1 text-sm text-slate-700">{receipt.transaction.resident_name}</p>
                <p className="text-sm text-slate-700">Received ₹{receipt.transaction.total_amount}</p>
                <button
                  type="button"
                  onClick={downloadReceipt}
                  className="mt-2 min-h-[36px] rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white"
                >
                  Download Receipt
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Generate a receipt from ledger entries to view and download it here.</p>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === "more" ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Function windows • More</p>
          
          <article className="rounded-3xl bg-slate-900 p-4 text-white shadow-panel">
            <div className="flex items-center gap-2">
              <BellRing size={18} />
              <h3 className="font-display text-base">Policy Alert</h3>
            </div>
            <p className="mt-2 text-sm text-slate-200">GST auto-applies at 12% when rent exceeds INR 1000 per day.</p>
          </article>

          <form className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Quick Owner Invite</h3>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Owner full name</span>
                <input
                  type="text"
                  placeholder="Owner full name"
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Owner email</span>
                <input
                  type="email"
                  placeholder="Owner email"
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                />
              </label>
              <button
                type="button"
                className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
              >
                Send Invite
              </button>
            </div>
          </form>

          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Operations & Reports</p>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h2 className="font-display text-lg text-slate-900">Monthly Amount Received</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Year</span>
                <input
                  type="number"
                  value={monthlyYear}
                  onChange={(event) => setMonthlyYear(Number(event.target.value))}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                />
              </label>
              <label className="grid grid-cols-1 gap-1 text-sm text-slate-700">
                <span>Month</span>
                <input
                  type="number"
                  value={monthlyMonth}
                  onChange={(event) => setMonthlyMonth(Number(event.target.value))}
                  min={1}
                  max={12}
                  className="min-h-[44px] rounded-xl border border-slate-300 px-3"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void loadMonthlySummary()}
              className="mt-2 min-h-[44px] w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
            >
              Refresh Monthly Summary
            </button>
            {monthlySummary ? (
              <div className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {monthlySummary.month}/{monthlySummary.year}
                </p>
                <p>Total Received: ₹{monthlySummary.total_received}</p>
                <p>Base Amount: ₹{monthlySummary.total_base_amount}</p>
                <p>GST Collected: ₹{monthlySummary.total_gst_collected}</p>
                <p>Transactions: {monthlySummary.transaction_count}</p>
              </div>
            ) : null}
          </article>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h2 className="font-display text-lg text-slate-900">Module Checks</h2>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={runMessMenuCheck}
                className="min-h-[44px] rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
              >
                Load Mess Menu
              </button>
              <button
                type="button"
                onClick={runGateCheckin}
                className="min-h-[44px] rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
              >
                Run Gate Check-in
              </button>
              <button
                type="button"
                onClick={runGstPreview}
                className="min-h-[44px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
              >
                Run GST Preview
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {messMenuItems.length > 0 ? `Mess menu: ${messMenuItems.join(", ")}` : "Mess menu not requested yet."}
            </p>
            <p className="mt-1 text-sm text-slate-700">{gateResult || "Gate check-in not requested yet."}</p>
            <p className="mt-1 text-sm text-slate-700">{gstResult || "GST preview not requested yet."}</p>
          </article>

          <article className={FUNCTION_WINDOW_CLASS}>
            <h3 className="font-display text-base text-slate-900">Reports (All Rooms & Residents)</h3>
            <p className="mt-2 text-sm text-slate-700">Rooms: {rooms.length}</p>
            <p className="text-sm text-slate-700">Residents: {residents.length}</p>
            <p className="text-sm text-slate-700">
              Monthly collected: ₹{monthlySummary ? monthlySummary.total_received : 0}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={downloadRoomsCsv}
                className="min-h-[44px] w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
              >
                Download Rooms CSV
              </button>
              <button
                type="button"
                onClick={downloadResidentsCsv}
                className="min-h-[44px] w-full rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white"
              >
                Download Residents CSV
              </button>
              <button
                type="button"
                onClick={downloadMonthlySummaryCsv}
                className="min-h-[44px] w-full rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white"
              >
                Download Monthly Collection CSV
              </button>
              <button
                type="button"
                onClick={downloadManagementReportCsv}
                className="min-h-[44px] w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
              >
                Download Full Report (CSV)
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Function windows • Settings</p>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Module Controls</p>
          {cards.map(({ title, key, icon: Icon, desc }) => (
            <article key={key} className={FUNCTION_WINDOW_CLASS}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex rounded-xl bg-teal-50 p-2 text-teal-700">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-display text-base text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{desc}</p>
                </div>
                <div className="flex min-h-[44px] min-w-[44px] items-center justify-center">
                  <Switch
                    checked={features[key]}
                    onCheckedChange={() => toggleFeature(key)}
                    aria-label={`Toggle ${title}`}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
