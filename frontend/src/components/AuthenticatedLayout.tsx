import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, UserResponse } from '../services/authService';

interface Props {
  user: UserResponse;
  children: React.ReactNode;
}

const AuthenticatedLayout: React.FC<Props> = ({ user, children }) => {
  const navigate = useNavigate();
  const logout = () => {
    authService.logout();
    navigate('/login');
  };
  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="navbar-content">
          <h1 className="navbar-title">Code Grading Platform</h1>
          <div className="navbar-user">
            <span className="user-name">{user.full_name} ({user.role})</span>
            <button className="logout-button" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>
      <main className="dashboard-main">{children}</main>
    </div>
  );
};

export default AuthenticatedLayout;
