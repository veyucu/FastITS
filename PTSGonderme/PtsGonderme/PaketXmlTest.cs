// Decompiled with JetBrains decompiler
// Type: PtsGonderme.PaketXmlTest
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System;
using System.Collections.Generic;
using System.Data.SqlClient;

#nullable disable
namespace PtsGonderme
{
  public class PaketXmlTest
  {
    public string sourceGLN;
    public string destinationGLN;
    public string actionType;
    public string shipTo;
    public string documentNumber;
    public string documentDate;
    public string note;
    public string version;
    public List<ProductList> productList = new List<ProductList>();
    public List<string> serialNumbers = new List<string>();
    public List<CarrierType> carrierTypes = new List<CarrierType>();

    public bool SaveToDB(string transferId, DatabaseConfig dbConfig)
    {
      try
      {
        using (SqlConnection connection = new SqlConnection("Data Source=" + dbConfig.DbServer + ";Initial Catalog=" + dbConfig.DbName + ";User Id=" + dbConfig.DbUser + ";Password=" + dbConfig.DbPass + ";"))
        {
          connection.Open();
          using (SqlCommand sqlCommand = new SqlCommand())
          {
            sqlCommand.Parameters.Clear();
            sqlCommand.Connection = connection;
            sqlCommand.CommandText = "INSERT INTO ATBLPTSMAS(TRANSFER_ID, SOURCE_GLN, DESTINATION_GLN, ACTION_TYPE, SHIP_TO, DOCUMENT_NUMBER, DOCUMENT_DATE, NOTE, INSERT_DATE) VALUES(@TRANSFER_ID, @SOURCE_GLN, @DESTINATION_GLN, @ACTION_TYPE, @SHIP_TO, @DOCUMENT_NUMBER, @DOCUMENT_DATE, @NOTE, @INSERT_DATE)";
            sqlCommand.Parameters.Add(new SqlParameter("TRANSFER_ID", (object) transferId));
            sqlCommand.Parameters.Add(new SqlParameter("SOURCE_GLN", (object) this.sourceGLN));
            sqlCommand.Parameters.Add(new SqlParameter("DESTINATION_GLN", (object) this.destinationGLN));
            sqlCommand.Parameters.Add(new SqlParameter("ACTION_TYPE", (object) this.actionType));
            sqlCommand.Parameters.Add(new SqlParameter("SHIP_TO", (object) this.shipTo));
            sqlCommand.Parameters.Add(new SqlParameter("DOCUMENT_NUMBER", (object) this.documentNumber));
            sqlCommand.Parameters.Add(new SqlParameter("DOCUMENT_DATE", (object) this.documentDate));
            sqlCommand.Parameters.Add(new SqlParameter("NOTE", (object) this.note));
            sqlCommand.Parameters.Add(new SqlParameter("INSERT_DATE", (object) DateTime.Now));
            sqlCommand.ExecuteScalar();
          }
          using (SqlCommand sqlCommand = new SqlCommand())
          {
            for (int index = 0; index < this.serialNumbers.Count; ++index)
            {
              sqlCommand.Parameters.Clear();
              sqlCommand.Connection = connection;
              sqlCommand.CommandText = "INSERT INTO ATBLPTSTRA(TRANSFER_ID, GTIN, EXPRATION_DATE, PRODUCTION_DATE, LOT_NUMBER, SERIAL_NUMBER, PO_NUMBER, CARRIER_LABEL, CONTAINER_TYPE, STOK_KOD) VALUES(@TRANSFER_ID, @GTIN, @EXPRATION_DATE, @PRODUCTION_DATE, @LOT_NUMBER, @SERIAL_NUMBER, @PO_NUMBER, @CARRIER_LABEL, @CONTAINER_TYPE, @STOK_KOD)";
              ProductList product = this.productList[index];
              sqlCommand.Parameters.Add(new SqlParameter("TRANSFER_ID", (object) PaketXmlTest.NullToString(transferId)));
              sqlCommand.Parameters.Add(new SqlParameter("GTIN", (object) PaketXmlTest.NullToString(product.GTIN)));
              sqlCommand.Parameters.Add(new SqlParameter("EXPRATION_DATE", (object) PaketXmlTest.NullToString(product.expirationDate)));
              sqlCommand.Parameters.Add(new SqlParameter("PRODUCTION_DATE", (object) PaketXmlTest.NullToString(product.productionDate)));
              sqlCommand.Parameters.Add(new SqlParameter("LOT_NUMBER", (object) PaketXmlTest.NullToString(product.lotNumber)));
              sqlCommand.Parameters.Add(new SqlParameter("SERIAL_NUMBER", (object) PaketXmlTest.NullToString(this.serialNumbers[index])));
              sqlCommand.Parameters.Add(new SqlParameter("PO_NUMBER", (object) PaketXmlTest.NullToString(product.PONumber)));
              CarrierType carrierType = this.carrierTypes[index];
              sqlCommand.Parameters.Add(new SqlParameter("CARRIER_LABEL", (object) PaketXmlTest.NullToString(carrierType.carrierLabel)));
              sqlCommand.Parameters.Add(new SqlParameter("CONTAINER_TYPE", (object) PaketXmlTest.NullToString(carrierType.containerType)));
              string stokKod = PaketXmlTest.GetStokKod(PaketXmlTest.NullToString(product.GTIN), connection);
              sqlCommand.Parameters.Add(new SqlParameter("STOK_KOD", (object) stokKod));
              sqlCommand.ExecuteScalar();
            }
          }
          connection.Close();
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine(ex.ToString());
      }
      return false;
    }

    private static string NullToString(string str) => string.IsNullOrEmpty(str) ? "" : str;

    private static string GetStokKod(string GTIN, SqlConnection connection)
    {
      string str = GTIN.Substring(1);
      using (SqlCommand sqlCommand = new SqlCommand("SELECT STOK_KODU FROM TBLSTSABIT WHERE STOK_KODU=@STOK_KODU OR BARKOD1=@BARKOD1 OR BARKOD2=@BARKOD2 OR BARKOD3=@BARKOD3", connection))
      {
        sqlCommand.Parameters.Clear();
        sqlCommand.Parameters.Add(new SqlParameter("STOK_KODU", (object) str));
        sqlCommand.Parameters.Add(new SqlParameter("BARKOD1", (object) str));
        sqlCommand.Parameters.Add(new SqlParameter("BARKOD2", (object) str));
        sqlCommand.Parameters.Add(new SqlParameter("BARKOD3", (object) str));
        SqlDataReader sqlDataReader = sqlCommand.ExecuteReader();
        if (sqlDataReader.Read())
        {
          string stokKod = sqlDataReader.GetString(sqlDataReader.GetOrdinal("STOK_KODU"));
          sqlDataReader.Close();
          return stokKod;
        }
        sqlDataReader.Close();
      }
      using (SqlCommand sqlCommand = new SqlCommand("SELECT STOK_KODU FROM TBLSTOKBAR WHERE STOK_KODU=@STOK_KODU", connection))
      {
        sqlCommand.Parameters.Clear();
        sqlCommand.Parameters.Add(new SqlParameter("STOK_KODU", (object) str));
        SqlDataReader sqlDataReader = sqlCommand.ExecuteReader();
        if (sqlDataReader.Read())
        {
          string stokKod = sqlDataReader.GetString(sqlDataReader.GetOrdinal("STOK_KODU"));
          sqlDataReader.Close();
          return stokKod;
        }
        sqlDataReader.Close();
      }
      return "";
    }
  }
}
