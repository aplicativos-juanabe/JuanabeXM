import { useState, useCallback } from "react";
import { NotificationContext } from "../context/NotificationContext";
import { CheckCircle, AlertTriangle, Info, XCircle, X } from "lucide-react";

const icons = {
  success: <CheckCircle className="text-green-600 w-5 h-5" />,
  error: <XCircle className="text-red-600 w-5 h-5" />,
  warning: <AlertTriangle className="text-yellow-600 w-5 h-5" />,
  info: <Info className="text-blue-600 w-5 h-5" />,
};

export default function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const push = useCallback((type, message, timeout = 3500) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => remove(id), timeout);
  }, []);

  const remove = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ push, remove }}>
      {children}
      <div className="fixed top-6 right-6 space-y-3 z-50">
        {notifications.map((note) => (
          <div
            key={note.id}
            className="w-80 bg-white shadow-xl border rounded-lg py-3 px-4 flex items-start gap-3 relative animate-fade-in"
          >
            {icons[note.type]}
            <div className="flex-1 text-gray-800 font-medium">{note.message}</div>
            <button
              onClick={() => remove(note.id)}
              className="text-gray-400 hover:text-gray-600 absolute top-2 right-2"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}