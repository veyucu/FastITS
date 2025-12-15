// Decompiled with JetBrains decompiler
// Type: PtsGonderme.NHLService.PushResult
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Xml.Serialization;

#nullable disable
namespace PtsGonderme.NHLService
{
  [GeneratedCode("System.Xml", "4.8.4084.0")]
  [DebuggerStepThrough]
  [DesignerCategory("code")]
  [XmlType(Namespace = "http://tempuri.org/")]
  [Serializable]
  public class PushResult
  {
    private bool isErrorField;
    private string errorMessageField;
    private int errorRowCountField;
    private ErrorTypes errorTypeField;
    private PushParameters resultDataField;

    public bool IsError
    {
      get => this.isErrorField;
      set => this.isErrorField = value;
    }

    public string ErrorMessage
    {
      get => this.errorMessageField;
      set => this.errorMessageField = value;
    }

    public int ErrorRowCount
    {
      get => this.errorRowCountField;
      set => this.errorRowCountField = value;
    }

    public ErrorTypes ErrorType
    {
      get => this.errorTypeField;
      set => this.errorTypeField = value;
    }

    public PushParameters ResultData
    {
      get => this.resultDataField;
      set => this.resultDataField = value;
    }
  }
}
