import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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
  showUndoPopup = false;
  undoEmployeeName = '';
  undoCountdown = 5;
  undoActionType: 'CREATE' | 'UPDATE' | 'DELETE' | null = null;
  pendingEmployee: Employee | null = null;
  pendingOriginalEmployee: Employee | null = null;
  private pendingTimeout: any = null;
  private undoCountdownInterval: any = null;
  private countdownInterval: any = null;
  private sseSubscription: Subscription | null = null;
  highlightedEmployeeIds: { [key: number]: string } = {};

  constructor(private employeeService: EmployeeService, private router: Router) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.extras && navigation.extras.state) {
      const state = navigation.extras.state as {
        pendingAction: 'CREATE' | 'UPDATE';
        employee: Employee;
        originalEmployee?: Employee;
      };
      if (state && state.pendingAction) {
        this.setupPendingAction(state.pendingAction, state.employee, state.originalEmployee);
        
        // Clear navigation history state immediately to prevent replay on reload/refresh
        if (typeof window !== 'undefined' && window.history && window.history.state) {
          const cleanState = { ...window.history.state };
          delete cleanState.pendingAction;
          delete cleanState.employee;
          delete cleanState.originalEmployee;
          window.history.replaceState(cleanState, '');
        }
      }
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent) {
    this.executeAnyPendingAction();
  }

  ngOnInit(): void {
    this.getEmployees();
    this.loadEventHistory();
    this.subscribeToEvents();
  }

  getEmployees() {
    this.employeeService.getEmployeesList().subscribe({
      next: (response) => {
        let list = response.body || [];

        // Apply pending actions to preserve optimistic state:
        if (this.undoActionType === 'CREATE' && this.pendingEmployee) {
          const exists = list.some(e => e.id === this.pendingEmployee!.id || (e.firstName === this.pendingEmployee!.firstName && e.lastName === this.pendingEmployee!.lastName && e.emailId === this.pendingEmployee!.emailId));
          if (!exists) {
            list = [...list, this.pendingEmployee];
          }
        } else if (this.undoActionType === 'UPDATE' && this.pendingEmployee) {
          list = list.map(e => e.id === this.pendingEmployee!.id ? this.pendingEmployee! : e);
        } else if (this.undoActionType === 'DELETE' && this.pendingEmployee) {
          list = list.filter(e => e.id !== this.pendingEmployee!.id);
        }

        this.employees = list;
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
    this.executeAnyPendingAction();
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }

  refreshList() {
    this.getEmployees();
  }

  updateEmployee(id: number) {
    this.router.navigate(['update-employee', id]);
  }

  setupPendingAction(type: 'CREATE' | 'UPDATE' | 'DELETE', employee: Employee, originalEmployee?: Employee) {
    this.executeAnyPendingAction();

    this.undoActionType = type;
    this.pendingEmployee = employee;
    this.pendingOriginalEmployee = originalEmployee || null;

    if (type === 'CREATE') {
      this.pendingEmployee.id = -1;
      this.undoEmployeeName = `${employee.firstName} ${employee.lastName}`.trim();
    } else if (type === 'UPDATE') {
      this.undoEmployeeName = `${employee.firstName} ${employee.lastName}`.trim();
    } else if (type === 'DELETE') {
      this.undoEmployeeName = `${employee.firstName} ${employee.lastName}`.trim();
    }

    this.showUndoPopup = true;
    this.undoCountdown = 5;

    this.undoCountdownInterval = setInterval(() => {
      this.undoCountdown--;
      if (this.undoCountdown <= 0) {
        this.clearUndoInterval();
      }
    }, 1000);

    this.pendingTimeout = setTimeout(() => {
      this.executeAnyPendingAction();
    }, 5000);
  }

  deleteEmployee(id: number) {
    const employeeToDelete = this.employees.find(e => e.id === id);
    if (!employeeToDelete) return;

    this.setupPendingAction('DELETE', employeeToDelete);
    this.employees = this.employees.filter(e => e.id !== id);
  }

  undoAction() {
    this.clearUndoTimeout();
    this.clearUndoInterval();

    const previousAction = this.undoActionType;
    const emp = this.pendingEmployee;
    const orig = this.pendingOriginalEmployee;

    this.undoActionType = null;
    this.pendingEmployee = null;
    this.pendingOriginalEmployee = null;
    this.showUndoPopup = false;

    if (previousAction === 'DELETE' && emp) {
      this.employees = [...this.employees, emp];
      this.employees.sort((a, b) => a.id - b.id);
    } else if (previousAction === 'CREATE' && emp) {
      this.employees = this.employees.filter(e => e.id !== -1);
    } else if (previousAction === 'UPDATE' && emp && orig) {
      this.employees = this.employees.map(e => e.id === orig.id ? orig : e);
    }
  }

  executeAnyPendingAction() {
    this.clearUndoTimeout();
    this.clearUndoInterval();

    if (!this.undoActionType || !this.pendingEmployee) {
      return;
    }

    const type = this.undoActionType;
    const emp = this.pendingEmployee;

    this.undoActionType = null;
    this.pendingEmployee = null;
    this.pendingOriginalEmployee = null;
    this.showUndoPopup = false;

    if (type === 'CREATE') {
      const { id, ...newEmployee } = emp as any;
      this.employeeService.createEmployee(newEmployee).subscribe({
        next: (savedEmployee) => {
          console.log('Created employee in database:', savedEmployee);
          this.highlightEmployee(savedEmployee.id, 'create');
          this.getEmployees();
        },
        error: (err) => {
          console.error('Error creating employee:', err);
          this.getEmployees();
        }
      });
    } else if (type === 'UPDATE') {
      this.employeeService.updateEmployee(emp.id, emp).subscribe({
        next: (updatedEmployee) => {
          console.log('Updated employee in database:', updatedEmployee);
          this.highlightEmployee(updatedEmployee.id, 'update');
          this.getEmployees();
        },
        error: (err) => {
          console.error('Error updating employee:', err);
          this.getEmployees();
        }
      });
    } else if (type === 'DELETE') {
      this.employeeService.deleteEmployee(emp.id).subscribe({
        next: (data) => {
          console.log('Deleted employee from database:', emp.id);
        },
        error: (err) => {
          console.error('Error deleting employee:', err);
          this.getEmployees();
        }
      });
    }
  }

  private clearUndoTimeout() {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }

  private clearUndoInterval() {
    if (this.undoCountdownInterval) {
      clearInterval(this.undoCountdownInterval);
      this.undoCountdownInterval = null;
    }
  }

  employeeDetails(id: number) {
    this.router.navigate(['employee-details', id]);
  }
}
