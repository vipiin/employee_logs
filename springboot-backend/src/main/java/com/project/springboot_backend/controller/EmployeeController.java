package com.project.springboot_backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Observable;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.project.springboot_backend.exception.ResourceNotFoundException;
import com.project.springboot_backend.kafka.KafkaProducerService;
import com.project.springboot_backend.model.Employee;
import com.project.springboot_backend.repository.EmployeeRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.ratelimiter.RequestNotPermitted;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/v1")
public class EmployeeController {
    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private RateLimiterRegistry rateLimiterRegistry;

    @Autowired
    private KafkaProducerService kafkaProducerService;


    // get all emp
    @GetMapping("/employees")
    @RateLimiter(name = "employeeListLimit", fallbackMethod = "getAllEmployeesFallback")
    public ResponseEntity<List<Employee>> getAllEmployees() {
        io.github.resilience4j.ratelimiter.RateLimiter rateLimiter = rateLimiterRegistry
                .rateLimiter("employeeListLimit");
        
        int remaining = rateLimiter.getMetrics().getAvailablePermissions();
        
        long periodNanos = rateLimiter.getRateLimiterConfig().getLimitRefreshPeriod().toNanos();
        long remainingNanos = periodNanos - (System.nanoTime() % periodNanos);
        long secondsToWait = (remainingNanos + 999_999_999L) / 1_000_000_000L;
        long millisToWait = remainingNanos / 1_000_000;
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-RateLimit-Limit", String.valueOf(rateLimiter.getRateLimiterConfig().getLimitForPeriod()));
        headers.add("X-RateLimit-Remaining", String.valueOf(remaining));
        headers.add("X-RateLimit-Reset-Seconds", String.valueOf(secondsToWait));
        headers.add("X-RateLimit-Reset-Millis", String.valueOf(millisToWait));
        
        return new ResponseEntity<>(employeeRepository.findAll(), headers, HttpStatus.OK);
    }

    public ResponseEntity<List<Employee>> getAllEmployeesFallback(RequestNotPermitted ex) {
        io.github.resilience4j.ratelimiter.RateLimiter rateLimiter = rateLimiterRegistry
                .rateLimiter("employeeListLimit");
        
        long periodNanos = rateLimiter.getRateLimiterConfig().getLimitRefreshPeriod().toNanos();
        long remainingNanos = periodNanos - (System.nanoTime() % periodNanos);
        long secondsToWait = (remainingNanos + 999_999_999L) / 1_000_000_000L;
        long millisToWait = remainingNanos / 1_000_000;
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-RateLimit-Limit", String.valueOf(rateLimiter.getRateLimiterConfig().getLimitForPeriod()));
        headers.add("X-RateLimit-Remaining", "0");
        headers.add("X-RateLimit-Reset-Seconds", String.valueOf(secondsToWait));
        headers.add("X-RateLimit-Reset-Millis", String.valueOf(millisToWait));
        headers.add("Retry-After", String.valueOf(secondsToWait));
        
        return new ResponseEntity<>(null, headers, HttpStatus.TOO_MANY_REQUESTS);
    }

    // create employee rest api
    @PostMapping("/employees")
    public Employee createEmployee(@RequestBody Employee employee) {
        Employee savedEmployee = employeeRepository.save(employee);
        kafkaProducerService.sendEmployeeCreatedEvent(savedEmployee);
        return savedEmployee;
    }

    // get employee by id
    @GetMapping("/employees/{id}")
    public ResponseEntity<Employee> getEmployeeById(@PathVariable Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee does not exist with id: " + id));
        return ResponseEntity.ok(employee);
    }

    // update employee rest api
    @PutMapping("/employees/{id}")
    public ResponseEntity<Employee> updateEmployee(@PathVariable Long id, @RequestBody Employee employeeDetails) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee does not exist with id: " + id));
        Employee oldEmployee=copyEmployee(employee);
        employee.setFirstName(employeeDetails.getFirstName());
        employee.setLastName(employeeDetails.getLastName());
        employee.setEmailId(employeeDetails.getEmailId());
        Employee updatedEmployee = employeeRepository.save(employee);
        kafkaProducerService.sendEmployeeUpdatedEvent(oldEmployee, updatedEmployee);
        return ResponseEntity.ok(updatedEmployee);
    }

    private Employee copyEmployee(Employee employee) {
        Employee emp=new Employee();
        emp.setFirstName(employee.getFirstName());
        emp.setLastName(employee.getLastName());
        emp.setEmailId(employee.getEmailId());
        emp.setId(employee.getId());
        return emp;
    }

    @DeleteMapping("/employees/{id}")
    public ResponseEntity<Map<String, Boolean>> deleteEmployee(@PathVariable Long id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee does not exist with id: " + id));
        employeeRepository.delete(employee);
        kafkaProducerService.sendEmployeeDeletedEvent(id);
        Map<String, Boolean> response = new HashMap<>();
        response.put("deleted", Boolean.TRUE);
        return ResponseEntity.ok(response);
    }
}
