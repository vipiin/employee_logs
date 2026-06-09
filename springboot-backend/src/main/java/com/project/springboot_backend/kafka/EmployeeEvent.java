package com.project.springboot_backend.kafka;

import com.project.springboot_backend.model.Employee;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeEvent {
    private String eventType;  // EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_DELETED
    private LocalDateTime timestamp;
    private Long employeeId;
    private Employee employee;  // Full employee data (for CREATE/UPDATE)
    private Map<String, ChangeDetail> changes;  // For UPDATE events only
    
    // For CREATE event
    public EmployeeEvent(String eventType, Employee employee) {
        this.eventType = eventType;
        this.timestamp = LocalDateTime.now();
        this.employeeId = employee.getId();
        this.employee = employee;
    }
    
    // For DELETE event
    public EmployeeEvent(String eventType, Long employeeId) {
        this.eventType = eventType;
        this.timestamp = LocalDateTime.now();
        this.employeeId = employeeId;
    }
    
    // For UPDATE event with change tracking
    public EmployeeEvent(String eventType, Employee employee, Map<String, ChangeDetail> changes) {
        this(eventType, employee);
        this.changes = changes;
    }
    
    // Inner class for tracking changes
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeDetail {
        private Object oldValue;
        private Object newValue;
    }
}