import { Component, OnInit, OnDestroy } from '@angular/core';
import { Employee } from '../employee';
import { CommonModule } from '@angular/common';
import { EmployeeService } from '../employee-service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

interface KafkaEventNotice {
  type: string;
  employeeId: number;
  employeeName: string;
  createdAt: Date;
}

@Component({
  selector: 'app-employee-list',
  imports: [CommonModule],
  templateUrl: './employee-list.html',
  styleUrl: './employee-list.css',
})
export class EmployeeList implements OnInit, OnDestroy {
  employees!: Employee[];
  remainingRequests: number | null = null;
  limit: number | null = null;
  isRateLimited = false;
  resetTimeRemaining: number | null = null;
  kafkaEvents: KafkaEventNotice[] = [];
  private countdownInterval: any = null;
  private sseSubscription: Subscription | null = null;
  highlightedEmployeeIds: { [key: number]: string } = {};

  constructor(private employeeService: EmployeeService, private router: Router) { }

  ngOnInit(): void {
    this.getEmployees();
    this.loadEventHistory();
    this.subscribeToEvents();
  }

  getEmployees() {
    this.employeeService.getEmployeesList().subscribe({
      next: (response) => {
        this.employees = response.body || [];
        this.isRateLimited = false;
        this.resetTimeRemaining = null;
        this.stopCountdown();

        const limitHeader = response.headers.get('X-RateLimit-Limit');
        const remainingHeader = response.headers.get('X-RateLimit-Remaining');
        const resetHeader = response.headers.get('X-RateLimit-Reset-Seconds');

        if (limitHeader) this.limit = parseInt(limitHeader, 10);
        if (remainingHeader) this.remainingRequests = parseInt(remainingHeader, 10);
        if (resetHeader) {
          this.resetTimeRemaining = parseInt(resetHeader, 10);
          this.startCountdown();
        }
      },
      error: (err) => {
        console.error('Error fetching employees:', err);
        if (err.status === 429) {
          this.isRateLimited = true;
          this.remainingRequests = 0;
          this.resetTimeRemaining = null;
          this.stopCountdown();

          const limitHeader = err.headers ? err.headers.get('X-RateLimit-Limit') : null;
          const resetHeader = err.headers ? (err.headers.get('X-RateLimit-Reset-Seconds') || err.headers.get('Retry-After')) : null;

          if (limitHeader) this.limit = parseInt(limitHeader, 10);
          if (resetHeader) {
            this.resetTimeRemaining = parseInt(resetHeader, 10);
            this.startCountdown();
          }
        }
      }
    });
  }

  startCountdown() {
    this.stopCountdown();
    if (this.resetTimeRemaining !== null && this.resetTimeRemaining > 0) {
      const targetEndTime = Date.now() + this.resetTimeRemaining * 1000;
      this.countdownInterval = setInterval(() => {
        const remaining = Math.max(0, Math.round((targetEndTime - Date.now()) / 1000));
        this.resetTimeRemaining = remaining;
        if (remaining === 0) {
          this.stopCountdown();
          this.isRateLimited = false;
          this.resetTimeRemaining = null;
          if (this.limit !== null) {
            this.remainingRequests = this.limit;
          }
        }
      }, 1000);
    }
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  subscribeToEvents() {
    this.sseSubscription = this.employeeService.getEmployeeEventsStream().subscribe({
      next: (event) => {
        console.log('Received SSE Event:', event);
        const newEvent = {
          type: event.eventType,
          employeeId: event.employeeId,
          employeeName: event.employee 
            ? `${event.employee.firstName} ${event.employee.lastName}`.trim()
            : `Employee ${event.employeeId}`,
          createdAt: event.timestamp ? new Date(event.timestamp) : new Date()
        };
        this.kafkaEvents = [newEvent, ...this.kafkaEvents].slice(0, 5);
        this.handleInMemoryEvent(event);
      },
      error: (err) => {
        console.error('SSE connection error, attempting automatic reconnection...', err);
      }
    });
  }

  loadEventHistory() {
    this.employeeService.getEmployeeEventsHistory().subscribe({
      next: (history) => {
        console.log('Received SSE history:', history);
        this.kafkaEvents = history.map(item => ({
          type: item.eventType,
          employeeId: item.employeeId,
          employeeName: item.employeeName || `Employee ${item.employeeId}`,
          createdAt: item.timestamp ? new Date(item.timestamp) : new Date()
        }));
      },
      error: (err) => {
        console.error('Failed to load event history from database:', err);
      }
    });
  }

  handleInMemoryEvent(event: any) {
    const id = event.employeeId;
    const type = event.eventType;
    if (type === 'EMPLOYEE_CREATED') {
      if (event.employee) {
        const index = this.employees.findIndex(e => e.id === id);
        if (index === -1) {
          this.employees = [...this.employees, event.employee];
        }
      }
      this.highlightEmployee(id, 'create');
    } else if (type === 'EMPLOYEE_UPDATED') {
      if (event.employee) {
        this.employees = this.employees.map(e => e.id === id ? event.employee : e);
      }
      this.highlightEmployee(id, 'update');
    } else if (type === 'EMPLOYEE_DELETED') {
      this.employees = this.employees.filter(e => e.id !== id);
    }
  }

  highlightEmployee(id: number, action: string) {
    this.highlightedEmployeeIds[id] = action;
    setTimeout(() => {
      delete this.highlightedEmployeeIds[id];
    }, 3000);
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }

  refreshList() {
    this.getEmployees();
  }
  updateEmployee(id: number) {
    this.router.navigate(['update-employee', id])
  }
  deleteEmployee(id: number) {
    this.employeeService.deleteEmployee(id).subscribe({
      next: (data) => {
        console.log(data);
      },
      error: (err) => {
        console.error('Error deleting employee:', err);
      }
    });
  }
  employeeDetails(id: number) {
    this.router.navigate(['employee-details', id]);
  }
}
