package com.project.springboot_backend.repository;

import com.project.springboot_backend.model.EmployeeEventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeEventLogRepository extends JpaRepository<EmployeeEventLog, Long> {
    List<EmployeeEventLog> findTop5ByOrderByTimestampDesc();
}
