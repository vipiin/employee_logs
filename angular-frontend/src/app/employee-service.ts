import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Employee } from './employee';
import {environment} from '../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class EmployeeService {
  private baseURL=`${environment.apiBaseUrl}/api/v1/employees`;
    constructor(private httpClient:HttpClient){

    }
    getEmployeesList():Observable<HttpResponse<Employee[]>>{
      return this.httpClient.get<Employee[]>(this.baseURL, { observe: 'response' });
    }

    createEmployee(employee: Employee): Observable<Employee>{
      return this.httpClient.post<Employee>(`${this.baseURL}`,employee);
    }

    getEmployeeById(id:number): Observable<Employee>{
      return this.httpClient.get<Employee>(`${this.baseURL}/${id}`);
    }

    updateEmployee(id:number,employee:Employee):Observable<Employee>{
      return this.httpClient.put<Employee>(`${this.baseURL}/${id}`,employee)
    }

    deleteEmployee(id:number):Observable<Object>{
     return this.httpClient.delete(`${this.baseURL}/${id}`);
    }

    getEmployeeEventsStream(): Observable<any> {
      return new Observable<any>(observer => {
        const eventSource = new EventSource(`${environment.apiBaseUrl}/api/events`);
        
        eventSource.onmessage = (event: MessageEvent) => {
          try {
            const parsedData = JSON.parse(event.data);
            observer.next(parsedData);
          } catch (err) {
            console.error('Error parsing SSE event data:', err);
          }
        };

        eventSource.onerror = (error) => {
          observer.error(error);
        };

        return () => {
          eventSource.close();
        };
      });
    }

    getEmployeeEventsHistory(): Observable<any[]> {
      return this.httpClient.get<any[]>(`${environment.apiBaseUrl}/api/events/history`);
    }
}

