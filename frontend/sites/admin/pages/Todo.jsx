import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Todo() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/admin/roadmap", { replace: true }); }, []);
  return null;
}
