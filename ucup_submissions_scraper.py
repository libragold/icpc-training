"""
UCup Submissions Scraper

This script scrapes submission data from Universal Cup (UCup) programming contest pages.
It handles pagination and can extract all submissions from a specified contest.

Usage:
    python ucup_submissions_scraper.py [contest_id]
"""

import time
import csv
import os
import glob
import argparse
import logging
from typing import List, Dict, Optional, Tuple, Any

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
from bs4 import BeautifulSoup


# Configuration
DEFAULT_MAX_PAGES = 3
DEFAULT_HEADERS = ["ID", "Problem", "Submitter", "Result", "Time", "Memory", "File size", "Submit time"]
DEFAULT_OUTPUT_FILE = 'ucup_submissions.csv'
SAMPLE_DATA_FILE = 'ucup_submissions_sample.csv'
BASE_URL = "https://contest.ucup.ac/contest/"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def cleanup_test_files() -> None:
    """
    Remove test files created during execution.
    
    This includes:
    - Page source HTML files
    - Per-page CSV files
    """
    # Remove HTML page source files
    html_files = glob.glob("page_*_source.html")
    for file in html_files:
        try:
            os.remove(file)
            logger.debug(f"Removed temporary file: {file}")
        except Exception as e:
            logger.warning(f"Failed to remove file {file}: {str(e)}")
    
    # Remove per-page CSV files
    csv_files = glob.glob("ucup_submissions_page_*.csv")
    for file in csv_files:
        try:
            os.remove(file)
            logger.debug(f"Removed temporary file: {file}")
        except Exception as e:
            logger.warning(f"Failed to remove file {file}: {str(e)}")
    
    logger.info("Cleaned up temporary test files")


def setup_driver() -> webdriver.Chrome:
    """
    Set up and configure the Chrome WebDriver for headless operation.
    
    Returns:
        webdriver.Chrome: Configured Chrome WebDriver instance
    """
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def construct_url(contest_id: str, page: int = 1) -> str:
    """
    Construct the URL for fetching submissions.
    
    Args:
        contest_id: The ID of the contest
        page: The page number
        
    Returns:
        str: The constructed URL
    """
    url = f"{BASE_URL}{contest_id}/submissions?v=1&page={page}"
    return url


def set_show_all_submissions_cookie(driver: webdriver.Chrome) -> None:
    """
    Set the cookie for showing all submissions.
    
    Args:
        driver: The WebDriver instance
    """
    domain = "contest.ucup.ac"
    
    # Add the cookie that enables "Show all submissions"
    cookie = {
        'name': 'show_all_submissions',
        'value': '',  # Value may be empty as observed
        'domain': domain,
        'path': '/',
    }
    
    logger.info("Setting 'show_all_submissions' cookie")
    driver.add_cookie(cookie)


def click_show_all_checkbox(driver: webdriver.Chrome) -> bool:
    """
    Attempt to click the "Show all submissions" checkbox.
    
    Args:
        driver: The WebDriver instance
        
    Returns:
        bool: True if checkbox was found and clicked, False otherwise
    """
    try:
        # Try to find and click the checkbox
        checkbox = WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.XPATH, "//input[@type='checkbox'][contains(following-sibling::text(), 'Show all submissions')]"))
        )
        logger.info("Found 'Show all submissions' checkbox, clicking it")
        
        # Use JavaScript to click the checkbox to avoid any potential issues
        driver.execute_script("arguments[0].click();", checkbox)
        time.sleep(1)  # Wait for page to update
        
        # Verify if the checkbox is now checked
        is_checked = driver.execute_script("return arguments[0].checked;", checkbox)
        logger.info(f"Checkbox checked status: {is_checked}")
        
        return True
    except Exception as e:
        logger.warning(f"Could not find or click 'Show all submissions' checkbox: {str(e)}")
        return False


def extract_table_headers(table: BeautifulSoup) -> List[str]:
    """
    Extract table headers from the table's thead section.
    
    Args:
        table: BeautifulSoup object representing the table
        
    Returns:
        List[str]: List of header names
    """
    headers = []
    header_row = table.find('thead')
    if header_row:
        header_row = header_row.find('tr')
        if header_row:
            for th in header_row.find_all('th'):
                headers.append(th.text.strip())
            logger.info(f"Found {len(headers)} headers: {headers}")
    
    # Use default headers if none found
    if not headers:
        headers = DEFAULT_HEADERS
        logger.info(f"Using default headers: {headers}")
        
    return headers


def has_none_placeholder(tbody: BeautifulSoup) -> bool:
    """
    Check if the table body contains a 'None' placeholder.
    
    Args:
        tbody: BeautifulSoup object representing the table body
        
    Returns:
        bool: True if a 'None' placeholder is found, False otherwise
    """
    for tr in tbody.find_all('tr'):
        for td in tr.find_all('td'):
            if td.has_attr('colspan') and td.text.strip() == "None":
                return True
    return False


def extract_rows(tbody: BeautifulSoup, headers: List[str]) -> List[List[str]]:
    """
    Extract rows of data from the table body.
    
    Args:
        tbody: BeautifulSoup object representing the table body
        headers: List of header names to validate row length
        
    Returns:
        List[List[str]]: List of rows, each containing cell values
    """
    rows = []
    
    for tr in tbody.find_all('tr'):
        # Skip rows with colspan
        if any(td.has_attr('colspan') for td in tr.find_all('td')):
            continue
        
        # Extract the row data
        cells = tr.find_all('td')
        if cells:
            row_data = [cell.text.strip() for cell in cells]
            
            # Adjust row length if necessary
            if len(row_data) != len(headers):
                logger.debug(f"Row has {len(row_data)} cells but expected {len(headers)}, adjusting...")
                # Pad or truncate as needed
                if len(row_data) < len(headers):
                    row_data.extend([''] * (len(headers) - len(row_data)))
                else:
                    row_data = row_data[:len(headers)]
                    
            rows.append(row_data)
            
    return rows


def print_page_stats(page_num: int, rows: List[List[str]], headers: List[str]) -> None:
    """
    Print statistics for a single page of submissions.
    
    Args:
        page_num: Page number
        rows: List of rows from the page
        headers: Column headers
    """
    if not rows:
        print(f"\n=== Page {page_num} Stats ===")
        print("No submissions found on this page")
        return
    
    # Create DataFrame for this page
    df = pd.DataFrame(rows, columns=headers)
    
    print(f"\n=== Page {page_num} Stats ===")
    print(f"Submissions on this page: {len(df)}")
    
    # Problem statistics if applicable
    if 'Problem' in df.columns and not df['Problem'].isna().all() and len(df['Problem'].unique()) > 1:
        problem_counts = df['Problem'].value_counts()
        print("\nProblems on this page:")
        for problem, count in problem_counts.items():
            if problem and problem.strip():
                print(f"  {problem}: {count} submission(s)")
    
    # Result statistics if applicable
    if 'Result' in df.columns and not df['Result'].isna().all() and len(df['Result'].unique()) > 1:
        result_counts = df['Result'].value_counts()
        print("\nResults on this page:")
        for result, count in result_counts.items():
            if result and result.strip():
                print(f"  {result}: {count} submission(s)")
    
    # Sample of data on this page
    if len(df) > 0:
        print("\nSample submissions from this page:")
        sample_size = min(3, len(df))
        print(df.head(sample_size).to_string(index=False))


def save_page_to_csv(page_num: int, rows: List[List[str]], headers: List[str]) -> None:
    """
    Save a single page of submissions to a CSV file.
    
    Args:
        page_num: Page number
        rows: List of rows from the page
        headers: Column headers
    """
    if not rows:
        return
        
    filename = f'ucup_submissions_page_{page_num}.csv'
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        writer.writerows(rows)
    
    logger.info(f"Saved {len(rows)} rows from page {page_num} to {filename}")


def scrape_ucup_submissions(contest_id: str, max_pages: int = DEFAULT_MAX_PAGES, 
                           save_per_page: bool = False) -> pd.DataFrame:
    """
    Scrape submissions data from UCup contest with pagination.
    
    Args:
        contest_id: The ID of the contest
        max_pages: Maximum number of pages to scrape
        save_per_page: Whether to save each page to a separate CSV file
    
    Returns:
        pd.DataFrame: DataFrame containing all scraped submission data
    """
    logger.info(f"Starting to scrape UCup submissions for contest {contest_id} (max {max_pages} pages)...")
    
    driver = setup_driver()
    all_rows = []
    headers = []
    
    try:
        # First navigate to the base URL (needed to set cookies properly)
        base_url = construct_url(contest_id, page=1)
        logger.info(f"Loading initial page: {base_url}")
        driver.get(base_url)
        time.sleep(2)  # Wait for page to load
        
        # Try two approaches for enabling "Show all submissions"
        # 1. Try clicking the checkbox
        checkbox_clicked = click_show_all_checkbox(driver)
        
        # 2. Set the cookie if checkbox wasn't found or clicking failed
        if not checkbox_clicked:
            set_show_all_submissions_cookie(driver)
            # Reload the page after setting the cookie
            driver.get(base_url)
            time.sleep(2)
        
        # Iterate through pages
        for page in range(1, max_pages + 1):
            page_url = construct_url(contest_id, page=page)
            logger.info(f"Scraping page {page}: {page_url}")
            
            # Load the page
            driver.get(page_url)
            time.sleep(3)  # Wait for page to load
            
            # Save the page source for debugging if needed
            if logger.level <= logging.DEBUG:
                with open(f"page_{page}_source.html", "w", encoding="utf-8") as f:
                    f.write(driver.page_source)
                logger.debug(f"Saved page source to page_{page}_source.html")
            
            # Extract data with BeautifulSoup
            soup = BeautifulSoup(driver.page_source, 'html.parser')
            
            # Find the submissions table
            table = soup.find('table', {'class': 'table'})
            if not table:
                logger.warning(f"No table found on page {page}, stopping.")
                break
            
            # Extract headers (only on first page)
            if page == 1:
                headers = extract_table_headers(table)
            
            # Extract rows
            tbody = table.find('tbody')
            if not tbody:
                logger.warning("No tbody found, skipping page")
                print_page_stats(page, [], headers)
                continue
            
            # Check if the table contains only a "None" placeholder
            if has_none_placeholder(tbody):
                logger.info("This page only contains placeholder 'None', skipping to next page")
                print_page_stats(page, [], headers)
                continue
            
            # Extract actual data rows
            rows_on_page = extract_rows(tbody, headers)
            logger.info(f"Extracted {len(rows_on_page)} submissions from page {page}")
            
            # Print stats for this page
            print_page_stats(page, rows_on_page, headers)
            
            # Save this page to CSV if requested
            if save_per_page:
                save_page_to_csv(page, rows_on_page, headers)
            
            # If no actual submissions found on this page, continue to next page
            if not rows_on_page:
                logger.info(f"No actual submissions found on page {page}")
                continue
                
            # Add rows to our collection
            all_rows.extend(rows_on_page)
            
    finally:
        # Clean up
        driver.quit()
    
    # Return empty DataFrame if no data found
    if not all_rows:
        logger.warning("No submission data found across any pages.")
        return pd.DataFrame(columns=headers)
    
    # Save data to CSV
    save_to_csv(all_rows, headers, DEFAULT_OUTPUT_FILE)
    
    # Create DataFrame
    return pd.DataFrame(all_rows, columns=headers)


def save_to_csv(data: List[List[str]], headers: List[str], filename: str) -> None:
    """
    Save data to a CSV file.
    
    Args:
        data: List of rows to save
        headers: Column headers
        filename: Name of the output file
    """
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        writer.writerows(data)
    
    logger.info(f"Saved {len(data)} rows to {filename}")


def generate_sample_data(save_per_page: bool = False) -> pd.DataFrame:
    """
    Generate sample submission data for demonstration purposes.
    
    Args:
        save_per_page: Whether to save each page of sample data to a separate CSV file
    
    Returns:
        pd.DataFrame: DataFrame containing sample submission data
    """
    logger.info("Generating sample submission data for demonstration...")
    
    headers = DEFAULT_HEADERS
    
    # Generic sample data for demonstration
    sample_data = [
        ["#100001", "A. Easy Problem", "Team 1", "AC", "10ms", "4096kb", "1.2kb", "00:15:30"],
        ["#100002", "A. Easy Problem", "Team 2", "WA", "5ms", "4096kb", "1.1kb", "00:17:45"],
        ["#100003", "B. Medium Problem", "Team 1", "AC", "100ms", "8192kb", "2.3kb", "00:45:20"],
        ["#100004", "B. Medium Problem", "Team 3", "TLE", "1000ms", "8192kb", "2.1kb", "01:05:12"],
        ["#100005", "C. Hard Problem", "Team 2", "WA", "50ms", "16384kb", "3.5kb", "01:30:45"],
        ["#100006", "C. Hard Problem", "Team 3", "AC", "500ms", "16384kb", "3.7kb", "01:55:10"],
        ["#100007", "D. Very Hard Problem", "Team 1", "AC", "750ms", "32768kb", "4.8kb", "02:25:30"],
        ["#100008", "D. Very Hard Problem", "Team 2", "MLE", "800ms", "131072kb", "4.9kb", "02:45:18"],
        ["#100009", "E. Extreme Problem", "Team 3", "WA", "900ms", "65536kb", "5.2kb", "03:15:25"],
        ["#100010", "E. Extreme Problem", "Team 1", "AC", "950ms", "65536kb", "5.5kb", "03:45:50"]
    ]
    
    # Simulate page-by-page stats for sample data
    page_size = 3
    for i in range(0, len(sample_data), page_size):
        page_num = i // page_size + 1
        page_rows = sample_data[i:i+page_size]
        print_page_stats(page_num, page_rows, headers)
        
        # Save page data to separate CSV if requested
        if save_per_page:
            save_page_to_csv(page_num, page_rows, headers)
    
    # Save sample data to CSV
    save_to_csv(sample_data, headers, SAMPLE_DATA_FILE)
    
    # Create DataFrame
    return pd.DataFrame(sample_data, columns=headers)


def print_data_summary(df: pd.DataFrame) -> None:
    """
    Print a summary of the scraped data.
    
    Args:
        df: DataFrame containing submission data
    """
    print("\nSummary of scraped data:")
    print(f"Total submissions: {len(df)}")
    
    if not df.empty:
        print("\nSample of scraped data:")
        print(df.head())
        
        # Additional statistics if data exists
        if 'Problem' in df.columns and len(df['Problem'].unique()) > 1:
            print(f"\nProblems submitted: {df['Problem'].nunique()}")
        
        if 'Result' in df.columns and len(df['Result'].unique()) > 1:
            results_count = df['Result'].value_counts()
            print("\nResults breakdown:")
            print(results_count)


def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        argparse.Namespace: Parsed arguments
    """
    parser = argparse.ArgumentParser(description='Scrape submissions from UCup contest')
    parser.add_argument('contest_id', nargs='?', default='1849', 
                        help='Contest ID (default: 1849)')
    parser.add_argument('--max-pages', type=int, default=DEFAULT_MAX_PAGES,
                        help=f'Maximum number of pages to scrape (default: {DEFAULT_MAX_PAGES})')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug logging')
    parser.add_argument('--save-per-page', action='store_true',
                        help='Save each page to a separate CSV file')
    parser.add_argument('--clean', action='store_true',
                        help='Clean up temporary files after execution')
    parser.add_argument('--only-clean', action='store_true',
                        help='Only clean up temporary files without scraping')
    
    return parser.parse_args()


def main() -> None:
    """
    Main function to run the script.
    """
    args = parse_arguments()
    
    # Set debug level if requested
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    # If only cleaning is requested, do that and exit
    if args.only_clean:
        cleanup_test_files()
        return
    
    # Scrape submissions
    df = scrape_ucup_submissions(args.contest_id, args.max_pages, args.save_per_page)
    
    # If no data was found, generate sample data
    if df.empty:
        print("\nNo real data found. Creating sample data for demonstration...")
        df = generate_sample_data(args.save_per_page)
    
    # Print summary
    print_data_summary(df)
    
    # Clean up if requested
    if args.clean:
        cleanup_test_files()


if __name__ == "__main__":
    main() 